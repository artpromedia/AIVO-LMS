# Runbook — DSAR end-to-end (access, export & right-to-erasure)

**Audience:** Privacy on-call · Platform on-call · **Severity:** P2
(P1 if a DSAR is past its statutory fulfillment SLA, or an erasure
fan-out leaves subject data confirmed-remaining) · **Last reviewed:**
Sprint 5

Use this to take a Data Subject Access Request from intake to a verified,
evidence-backed close: verifying the requester, assigning and approving,
running the export or right-to-erasure fan-out, handling a subscriber
service that fails to confirm, verifying zero-records-remaining (or
anonymized-only), handling an SLA breach, and producing the evidence
bundle.

The architecture this runbook drives is ADR 0034
(`docs/adr/0034-data-governance.md`): a central orchestrator in
`services/data-governance-svc` runs the DSAR lifecycle and fans erasure
/ export out to each data-owning service's internal
`POST /__governance/erase|export`, reconciled by per-service checksums.
The audit log is anonymized, never hard-deleted (it is hash-chained;
see `docs/runbooks/audit-restore.md`).

## Symptoms / triggers

- A DSAR is filed at `POST /dsar` (publicly via `/privacy/request`) and
  lands in `intake` awaiting an operator.
- A DSAR is **approaching or past its fulfillment SLA** — the compliance
  console shows an overdue banner and status-page-svc has been paged.
- An erasure fan-out **did not fully reconcile**: one or more subscribers
  never emitted `subject.erasure.completed`, or a checksum does not match.
- A subject (or a regulator / DPA) **disputes** that erasure happened, or
  asks for the portable export bundle.
- A `subject.export.requested` flow produced an incomplete bundle (a
  service's `/__governance/export` returned nothing or errored).

## Pre-conditions

- You can read the governance database (`dsar_requests`, `dsar_events`,
  `retention_policies`, `consents`, `data_catalog`) as a read-only
  operator, and the `audit_events` stream.
- For approve / reject / fulfill and for triggering erasure you hold the
  right role (ADR 0034 §9): `platform_admin` for any subject, or
  `district_admin` for your own district's subjects. **Erasure requires
  step-up MFA** for anyone below `platform_admin`.
- The DSAR id is in hand, plus the `subject_id` it targets.

## Intake verification

Do this **before** approving anything. The whole bundle's defensibility
rests on having verified the requester.

### 1. Identity proofing (subject acting for themselves)

A DSAR is admissible from anyone with a **verified identity**. Confirm
the requester's identity is verified in identity-svc and that the
`subject_id` on the request is the requester's own subject (or one they
are authorised to act for, below). A request to act on *someone else's*
data without an authorised relationship is a **reject**, with the reason
recorded.

### 2. Parent-on-behalf-of-minor (COPPA, under 13)

A parent may file for a learner **under 13** under COPPA verifiable
parental consent. Confirm:

- The parent is the **parent of record** for the learner (identity-svc
  relationship), and
- An active, non-revoked consent exists in the consent ledger
  (`consents`) tying the parent to the learner — read the **most recent**
  ledger row, since the ledger is append-only:

```sql
SELECT subject_id, consent_type, state, recorded_at, actor_id
  FROM consents
 WHERE subject_id = '<learner_subject_id>'
   AND consent_type = 'child_data_collection'
 ORDER BY recorded_at DESC
 LIMIT 5;
```

If the most recent row is a revocation, or no parental relationship
exists, the parent is not authorised — reject and record the reason.

## Assignment & approval

1. **Assign** the DSAR to yourself or the owning operator:
   `POST /dsar/{id}/assign`. This appends an `assigned` event to
   `dsar_events`.
2. **Determine the regime(s)** and therefore the SLA. If any GDPR basis
   applies, the **30-day** fulfillment window is enforced (the stricter
   of GDPR Art. 12's 30 days vs CCPA's 45 — ADR 0034 §8). Acknowledgement
   is 72h regardless.
3. **Approve or reject:** `POST /dsar/{id}/approve` or
   `POST /dsar/{id}/reject`. Approval is what authorises the fan-out. A
   rejection must carry a reason (identity not verified, requester not
   authorised, not a valid data subject) and is itself recorded in
   `dsar_events` and `audit_events`.

## Running the fan-out

`POST /dsar/{id}/fulfill` triggers the fan-out appropriate to the request
type.

### Export (access / portability)

The orchestrator publishes `subject.export.requested`. Every service
that owns a data class for the subject (per `data_catalog`) runs its
`POST /__governance/export` and returns structured JSON. The orchestrator
reassembles them into one **GDPR Art. 20 portable bundle**: machine-
readable JSON with a manifest of contributing services, record counts,
and timestamp. Download via `GET /dsar/{id}/export`.

### Erasure (right-to-erasure)

The orchestrator publishes `subject.erasure.requested`. Every expected
subscriber runs `POST /__governance/erase` (purge or anonymize by
`subject_id`) and replies with `subject.erasure.completed` carrying a
**checksum of affected record counts**. The DSAR reaches `fulfilled`
**only when every expected subscriber confirms and checksums reconcile**.

Note: **audit-svc anonymizes, it does not delete** (ADR 0034 §4). Its
`/__governance/erase` strips actor-identifying fields in place while
preserving the hash chain. "Zero records remaining" does **not** apply to
audit-svc — for it, the correct end state is *anonymized-only*.

## Diagnose — when the fan-out doesn't reconcile

Work from the three timelines: the DSAR's own (`dsar_events`), the
audit stream (`audit_events`), and the orchestrator's completed-event
checksums.

### 1. The DSAR timeline

```sql
SELECT seq, event_type, service, detail, created_at
  FROM dsar_events
 WHERE dsar_id = '<dsar_id>'
 ORDER BY seq;
```

This shows intake → assigned → approved → fulfill-triggered and one
row per service confirmation. A `fulfill`-triggered DSAR still in a
non-`fulfilled` state means **not every expected service confirmed** —
read on.

### 2. Which subscribers were expected vs. which confirmed

The expected set is the services owning a data class in the catalog:

```sql
SELECT DISTINCT owning_service
  FROM data_catalog
 ORDER BY owning_service;
```

Diff that against the services that emitted a `subject.erasure.completed`
(or `subject.export.*`) for this DSAR in `dsar_events`. Any expected
service **missing** from the confirmations is a **partial fan-out** — it
either never received the event or errored inside `/__governance/erase`.

### 3. Checksum mismatch

For services that *did* confirm, compare the reported checksum / counts
against expectation. A `subject.erasure.completed` whose checksum does
not reconcile means the service ran but **purged/anonymized a different
record set than the orchestrator expected** — investigate that service's
`/__governance/erase` (it may key on the wrong column, or the subject has
data the catalog didn't predict). Cross-reference `audit_events` for the
service's governance action:

```sql
SELECT occurred_at, action, resource_type, resource_id, metadata
  FROM audit_events
 WHERE action LIKE 'subject.erasure.%'
   AND metadata->>'dsar_id' = '<dsar_id>'
 ORDER BY occurred_at;
```

## Resolution

### A. Partial fan-out — a subscriber never confirmed

1. Confirm the service is healthy and its `/__governance/erase` (or
   `/export`) endpoint is reachable service-to-service (it is internal-
   only by design; ADR 0034 §2). A wedged or deploying service is the
   common cause.
2. **Re-issue** the fan-out for the missing subscriber(s) by re-running
   `POST /dsar/{id}/fulfill`. The contract is idempotent on `subject_id`
   — a service that already purged the subject re-confirms with the same
   checksum; a service that missed the first event now acts.
3. Watch `dsar_events` until the missing service emits its
   `*.completed`. The DSAR auto-advances to `fulfilled` once **all**
   expected services confirm and checksums reconcile.

### B. Checksum mismatch — a subscriber confirmed the wrong set

Do **not** mark the DSAR fulfilled. Treat the mismatch as a defect in
that service's governance handler:

1. Identify the service from §3 and inspect what its `/__governance/erase`
   matched for the `subject_id`.
2. If it under-purged (left subject records), fix the handler's
   subject-keying and re-run the fan-out (A.2). If it over-purged
   (touched another subject), this is a P1 data-integrity incident —
   escalate immediately and file a postmortem.
3. Only when the re-run produces a reconciling checksum does the DSAR
   advance.

### C. SLA breach — overdue or about to be

The compliance console banner and the status-page-svc page fire on
approaching/passed fulfillment SLA (30 days under GDPR; ADR 0034 §8).

1. Identify the blocking step from `dsar_events` (stuck in `approved`
   with no fulfill? stuck mid-fan-out with a missing subscriber?).
2. Drive that step to done — usually branch A or B above.
3. If the statutory window will be missed regardless, **record the
   reason and the remediation timeline in `dsar_events`** and notify the
   subject within the regime's rules. A missed SLA with a documented
   cause and cure is defensible; a silent miss is not.
4. File a postmortem for any DSAR that breaches its statutory window.

## Verification

Before closing the DSAR, confirm the end state is provable:

- **Erasure — zero-records-remaining.** Every expected non-audit service
  emitted `subject.erasure.completed` and its checksum reconciles to the
  expected (purged) counts. Re-running `/__governance/export` for the
  subject against those services returns **no subject records** (an empty
  bundle section), confirming nothing was left behind.
- **Erasure — audit is anonymized-only.** audit-svc's confirmation shows
  actor fields anonymized with **row count and hash chain unchanged**.
  Run the audit chain verify (`docs/runbooks/audit-restore.md`) and
  expect `valid: true` — erasure must not have broken the chain.
- **The DSAR is `fulfilled`** in `dsar_requests`, with a complete
  `dsar_events` timeline from intake to fulfillment.
- **The evidence bundle** is downloadable at `GET /dsar/{id}/export` and
  its manifest lists every contributing service, record counts, and the
  fulfillment timestamp.

## Producing the evidence bundle

The evidence bundle is the artifact you hand a regulator, a DPA auditor,
or the subject:

- `GET /dsar/{id}/export` returns the machine-readable JSON bundle +
  manifest (GDPR Art. 20 portable).
- Attach the `dsar_events` timeline (the lifecycle proof) and the
  per-service `subject.*.completed` checksums (the reconciliation proof).
- For an erasure, include the audit-chain `valid: true` verification as
  proof the anonymization preserved tamper-evidence.

Keep the bundle within its own retention rule — it contains subject data
and is itself governed by `data_catalog` / `retention_policies`.

## Escalation

- **A subscriber service's `/__governance/*` handler is wrong**
  (under/over-purge, checksum logic) → that service's owning team; over-
  purge across subjects is a **P1 data-integrity incident**.
- **DSAR past its statutory fulfillment SLA** → Privacy & Compliance
  Working Group; file a postmortem.
- **Audit chain reports a break after erasure** → SecOps + the audit
  team; follow `docs/runbooks/audit-restore.md`. Anonymization must
  never break the chain — a break here is a bug in audit-svc's
  `/__governance/erase`, not a normal restore.
- **Internal `/__governance/*` endpoint reachable from the public edge,
  or accepting a non-internal credential** → SecOps immediately; these
  purge by subject id and must be service-to-service only with an
  internal service token (ADR 0018), never an env-var-sourced secret at
  runtime.

## References

- ADR 0034 — data governance: DSAR, erasure orchestration & retention
  (`docs/adr/0034-data-governance.md`).
- ADR 0018 — secrets management (internal service tokens in vault).
- ADR 0020 — single shell, multi-role identity (RBAC, step-up MFA).
- `docs/runbooks/audit-restore.md` — audit hash-chain verify & restore.
- `docs/legal/privacy-program.md` — regulatory scope and subject rights.
- `docs/audit-event-taxonomy.md` — audit event shape & redaction.
- `docs/deletion-workflow.md` — the deletion state machine + retention
  holds that erasure honours.
- `services/data-governance-svc/src/routes/dsar/` — DSAR endpoints.
