# 0034 — Data governance: DSAR, erasure orchestration & retention

- **Status:** Accepted
- **Date:** 2026-06-02
- **Deciders:** Platform Engineering, Privacy & Compliance Working Group
- **Related:** Sprint 5 "Compliance Console: DSAR, Retention,
  FERPA/COPPA/GDPR",
  `services/data-governance-svc/src/routes/dsar/`,
  ADR 0018 (secrets management), ADR 0020 (single shell, multi-role
  identity), `docs/runbooks/dsar.md`, `docs/legal/privacy-program.md`,
  `docs/audit-event-taxonomy.md`, `docs/runbooks/audit-restore.md`
  (audit hash-chain immutability), `docs/deletion-workflow.md`.

## Context

AIVO is a K-12 product subject to the strictest overlapping privacy
regimes: FERPA (education records), COPPA (verifiable parental consent
for learners under 13), GDPR Arts. 15-22, and CCPA/CPRA. A data subject
— a parent acting for a learner, a learner with a verified identity, a
staff member — has the right to ask what we hold, to receive a portable
copy, to correct it, and to have it erased. These rights span **every
data-owning service**: identity, assessment, lesson runtime, family,
billing, audit, and more. No single service owns "all of a subject's
data".

Until Sprint 5, governance was partial and per-surface. `parent-export`
built a learner bundle (`docs/parent-export-format.md`) and a deletion
state machine existed (`docs/deletion-workflow.md`), but:

- **There was no subject-wide fan-out.** Each governance action reached
  into the data-governance service's own view of a learner. A true
  right-to-erasure must reach assessment responses, lesson history,
  billing identifiers, notification queues, and more — data owned by
  services that data-governance-svc cannot and should not read directly.
- **There was no reconciliation that erasure actually happened.** A
  "delete" that no service confirms is a compliance liability, not a
  control. We need evidence, per service, that records were purged or
  anonymized.
- **Retention was a single policy, not per-data-class.** A chat
  transcript, an IEP, a hashed audit record, and a billing invoice have
  very different lawful retention windows. One global TTL is wrong for
  all of them.
- **The audit log is append-only and hash-chained** (see
  `docs/audit-event-taxonomy.md`, `docs/runbooks/audit-restore.md`).
  Erasure cannot hard-delete audit rows without breaking the chain and
  destroying the tamper-evidence that the rest of compliance depends on.
- **SLAs differ by regime and tenant.** GDPR Art. 12 gives 30 days to
  fulfill; CCPA gives 45. A DSAR that touches a GDPR subject must meet
  the stricter window.

We need an architecture that lets a central console drive a subject's
rights across the whole platform, proves each service complied, respects
per-data-class retention, and never breaks the audit chain.

## Decision

We introduce a **central governance orchestrator** in
`services/data-governance-svc` that drives DSARs through a lifecycle and
fans erasure/export out to data-owning services over an **event-driven
subscriber contract**, reconciled by per-service checksums.

### 1. DSAR lifecycle as an explicit state machine

A Data Subject Access Request moves through:

```
intake -> assigned -> approved | rejected -> fulfilled
```

Every transition appends to `dsar_events` (the per-request timeline) and
emits an `audit_events` entry. Routes live under
`services/data-governance-svc/src/routes/dsar/`:

- `POST /dsar` — intake. Open to **anyone with a verified identity**, OR
  a **parent acting on behalf of a learner under 13** (COPPA verifiable
  parental consent). Intake records the requester, the subject, the
  request type (access / portability / rectification / erasure /
  restriction / objection), and the applicable regime(s).
- `GET /dsar?status=` / `GET /dsar/{id}` — list and detail.
- `POST /dsar/{id}/assign|approve|reject|fulfill` — operator
  transitions.
- `GET /dsar/{id}/export` — download the evidence bundle.

Backed by `dsar_requests` (current state) and `dsar_events` (append-only
timeline), mirroring the materialised-state-plus-append-log pattern used
for seat allocations in ADR 0033.

### 2. Per-service `/__governance/erase|export` subscriber contract

Each data-owning service implements two **internal-only** endpoints,
unreachable from the public edge:

- `POST /__governance/erase` — purge or anonymize every record keyed by
  `subject_id` that the service owns.
- `POST /__governance/export` — emit the service's records for
  `subject_id` as structured JSON.

The orchestrator never reaches into another service's tables. It
publishes an event; the owning service acts on its own data and reports
back. This is a **contract, not a query**: the orchestrator knows the
*shape* of the response (checksum + counts for erase; a JSON bundle for
export), not the internal schema behind it.

### 3. Event-driven fan-out with checksum reconciliation

Erasure and export are fan-out/fan-in flows:

- **Erasure.** The orchestrator publishes `subject.erasure.requested`
  carrying the `subject_id` and DSAR id. Every subscriber runs its
  `POST /__governance/erase`, then replies with
  `subject.erasure.completed` carrying a **checksum of affected record
  counts**. The orchestrator holds a manifest of expected subscribers
  (the data-class catalog, §5) and marks the DSAR `fulfilled` only when
  **every** expected service has confirmed and the checksums reconcile.
- **Export.** The same pattern: `subject.export.requested` →
  `POST /__governance/export` → JSON bundles → reassembled into one
  GDPR Art. 20 portable bundle (§6).

A missing confirmation (a subscriber that never replies) leaves the DSAR
**not fulfilled** — partial fan-out is a first-class, detectable state,
not a silent success. The runbook (`docs/runbooks/dsar.md`) covers
partial fan-out and checksum mismatch.

### 4. audit-svc anonymizes; it does not hard-delete (hash chain preserved)

The audit log is append-only and hash-chained; every row's `hash`
covers the prior row's `hash` (`docs/runbooks/audit-restore.md`).
Hard-deleting a subject's audit rows would break the chain and destroy
the tamper-evidence the whole compliance posture rests on.

So audit-svc's `POST /__governance/erase` **anonymizes actor-identifying
fields** (actor id, ip hash, user-agent hash, any subject-linking
columns) **in place, while preserving the hash chain**: the row count,
ordering, `prevHash`/`hash` links, and `action`/`occurredAt` are
untouched. After erasure, the audit log still proves *that* an action
occurred and *when*, but no longer ties it to the erased subject. This
is the lawful-basis exception we rely on (retention of a tamper-evident
security/compliance log) and is documented as such in
`docs/legal/privacy-program.md`.

### 5. Retention policy per data class, backed by a catalog

Retention is configured **per data class**, not globally:

- `data_catalog` — one row per data class: `class`, owning service,
  `sensitivity` tier, and the `retention_rule` that governs it. This
  catalog is also the **authoritative subscriber manifest** for the
  fan-out in §3 — a service appears in the erasure/export fan-out
  because it owns a data class in the catalog.
- `retention_policies` — the configurable per-data-class rule
  (window, hard-delete vs anonymize, legal-hold behaviour). Policies are
  per-tenant configurable by `platform_admin`.

This makes "what do we hold, who owns it, how sensitive is it, how long
do we keep it" a single queryable surface, and keeps the fan-out
manifest from drifting away from reality.

### 6. Consent ledger as an append-only record

`consents` is an **append-only ledger**: grant and revoke are both
appended rows, never updates in place. The effective consent state for a
subject/type is the most recent row. `POST` records a grant, `revoke`
appends a revocation, `GET` returns current state. This gives auditors a
provable history of when consent existed — essential for COPPA
verifiable parental consent and for proving lawful basis at the moment a
given piece of data was collected. It mirrors the consent events already
catalogued in `docs/compliance/consent-matrix.md`.

### 7. Portable export bundle (GDPR Art. 20)

The export bundle reassembled in §3 is **machine-readable, structured
JSON with a manifest** listing every contributing service, its record
counts, and the export timestamp — satisfying GDPR Art. 20 portability.
The bundle is downloadable via `GET /dsar/{id}/export` and is the
evidence artifact attached to the DSAR.

### 8. Stricter-SLA rule (30 days enforced)

SLAs are configurable per tenant but bounded by regime. Acknowledgement:
72h. Fulfillment: GDPR Art. 12 gives **30 days**, CCPA gives **45**. The
orchestrator enforces the **stricter** applicable window — 30 days when
a GDPR basis applies — rather than the laxer one. Overdue DSARs raise a
banner in the compliance console and **page status-page-svc** so an
approaching breach is visible operationally, not just in a report.

### 9. RBAC (keyed off active role, ADR 0020)

- **`platform_admin`** — configure retention policies, process any DSAR,
  trigger erasure for any subject.
- **`district_admin`** — process DSARs and trigger erasure **for their
  own district's subjects only**. Erasure requires **step-up MFA**.
- **`school_admin`** — **view the consent ledger for their own school
  only**; no erasure, no cross-tenant visibility.

Erasure is the highest-blast-radius operation and is gated by step-up
MFA for everyone below `platform_admin`, consistent with the admin
step-up policy used in ADR 0033.

## Consequences

**Positive**

- A subject's rights are honoured **across the whole platform** from one
  console, without the governance service ever reading another service's
  tables — each service stays the authority over its own data.
- Erasure and export produce **evidence**: per-service checksums and a
  manifest prove what was purged/anonymized and exported, which is
  exactly what a regulator or DPA audit asks for.
- The audit chain survives erasure, so tamper-evidence and SOC 2
  posture are preserved even as subject data is removed.
- Retention is correct *per data class* — IEPs, chat, audit hashes, and
  invoices each follow their own lawful window — and the catalog keeps
  the fan-out manifest honest.
- Enforcing the stricter (30-day) SLA means we never under-comply when
  regimes overlap.

**Negative / risks**

- **Fan-out reliability is now a compliance control.** A subscriber that
  silently drops `subject.erasure.requested` leaves a DSAR unfulfilled
  past its SLA. Mitigated by the expected-subscriber manifest (§5),
  checksum reconciliation, the overdue banner + status-page page, and
  the partial-fan-out branch of `docs/runbooks/dsar.md`.
- **Every new data-owning service must implement the contract.** Adding
  a service that holds subject data but no `/__governance/*` endpoints
  creates a silent gap. The catalog is the guardrail: a data class with
  no implementing subscriber is a catalog defect to be caught in review.
- **Anonymize-not-delete for audit is a deliberate retained-data
  position.** It must be defensible in the privacy program narrative
  (`docs/legal/privacy-program.md`) and communicated to subjects, or it
  looks like incomplete erasure.
- **Internal `/__governance/*` endpoints are high-value.** They purge
  data by subject id and must be reachable only service-to-service,
  never from the public edge, and must require an internal service
  token (ADR 0018) — never a credential read from `process.env` at
  runtime.

**Neutral / follow-ups**

- Cross-regime SLA edge cases (a subject under both GDPR and a state law
  with a *shorter* statutory window than 30 days) reduce to the same
  "enforce the strictest" rule but should be re-checked as state laws
  evolve; the privacy program doc tracks scope.
- A reconciliation job that periodically re-asserts erasure (re-issues
  `subject.erasure.requested` for any DSAR whose checksums never
  reconciled) is a follow-up hardening item, not part of the initial
  cut.
- A compliance-console UI for the DSAR timeline and the catalog is a
  separate front-end work item.

## Alternatives Considered

- **A central database that sweeps every service's tables.** Give the
  governance service direct read/write across all schemas and delete
  subject rows itself. Rejected: it couples the governance service to
  every other service's internal schema (any migration elsewhere breaks
  it), concentrates platform-wide write access in one blast-radius
  service, and produces no per-service evidence that the owning service
  agrees the data is gone. The subscriber contract keeps each service
  the authority over its own data and yields a checksum per service.
- **Each service polling the orchestrator for pending erasures.**
  Subscribers poll a "what should I erase?" endpoint on a timer.
  Rejected: it adds latency to a time-boxed (30-day) obligation, makes
  the fan-in/reconciliation ad hoc, and turns "did everyone comply?"
  into a polling-lag question rather than a checksum-reconciled fact.
  Event-driven fan-out with explicit `*.completed` confirmations is
  both faster and provable.
- **Hard-delete everything, including audit rows.** Purge the subject
  from the audit log too. Rejected: it breaks the append-only hash chain
  (`docs/runbooks/audit-restore.md`), destroys tamper-evidence and SOC 2
  posture, and removes the security/compliance log we have a lawful
  basis (and obligation) to retain. Anonymize-in-place is the
  reconciling choice.
- **One global retention TTL.** A single platform-wide retention window.
  Rejected: IEPs, chat transcripts, hashed audit records, and billing
  invoices have materially different lawful windows; one TTL is wrong
  for nearly all of them. Per-data-class policy backed by the catalog is
  the correct granularity.
- **Mutable consent (update-in-place).** Store one consent row per
  subject/type and overwrite on grant/revoke. Rejected for the same
  reason as mutable seat allocations in ADR 0033: it loses the history
  needed to prove consent *existed at the time data was collected*,
  which COPPA verifiable-parental-consent audits require. The ledger is
  append-only.
- **Honour the laxer SLA (45 days) uniformly.** Simpler, but
  under-complies for GDPR subjects. Rejected: enforce the stricter
  applicable window.
