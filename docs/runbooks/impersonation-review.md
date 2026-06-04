# Runbook — Impersonation Compliance Review

Monthly review of all "View As" (impersonation) activity for the prior
period. Architecture is in ADR 0038; audit-chain mechanics in ADR 0032.

## Purpose

Impersonation is a privileged capability: an admin can view (and, when
explicitly justified, write) as another user, including **minors**. This
review provides the periodic, documented assurance — for SOC 2 / ISO 27001
/ FERPA / COPPA — that **every** session had a lawful basis, stayed within
policy, and was correctly attributed. The output is a signed-off evidence
record per month.

## Cadence

- **Monthly**, covering the previous calendar month.
- Owner: Security/Compliance lead (reviewer) + Platform on-call (data pull).
- Target: completed and signed off within **5 business days** of month end.
- Any red flag found (see below) is escalated **immediately**, not deferred
  to the next review.

## 1. Pull the impersonation audit trail

Two corroborating sources — use **both**; a session must appear consistently
in each.

**A. Session history (identity-svc):**

```
GET /api/impersonation/history?from=<month-start>&to=<month-end>
```

Returns the `impersonation_sessions` rows: `imp_sid`, acting admin (`act`),
subject (`sub`), tenant, RBAC decision, consent basis, break-glass flag,
`imp_writes_ok`, requested vs clamped TTL, start/stop times. The
platform/district **history viewers** in `apps/web-v2` render the same data
scoped to the viewer.

**B. Per-request audit events (Sprint 3 audit UI / audit-svc):**

```
GET /events?action=auth.impersonation.request&from=...&to=...
GET /events?action=auth.impersonation.write_allowed&from=...&to=...
GET /events?action=auth.impersonation.write_blocked&from=...&to=...
GET /events?action=auth.impersonation.expired&from=...&to=...
GET /events?actorId=<act>            # everything one admin did
GET /events?q=<imp_sid>              # all events for one session
```

Each event carries the acting admin (`act`), subject (`sub`), and `imp_sid`,
so you can reconstruct exactly what each session did. Export the window for
offline analysis: `GET /export?format=ndjson&action=auth.impersonation.*`.

Confirm chain integrity first (`GET /events/verify`) — if the audit chain is
broken, stop and follow `docs/runbooks/audit-incident-response.md` before
trusting any of these numbers.

## 2. Review checklist

Work the month's sessions. **Every** session must satisfy **every** item.

- [ ] **Reason + valid basis present.** Each session has a non-empty
      `imp_reason` and a recorded consent basis (`SUBJECT_CONSENT`,
      `JUSTIFICATION_TICKET`, `PLATFORM_OVERRIDE`, `BREAK_GLASS`,
      `GUARDIAN_CONSENT`, or `OPEN_INCIDENT`). No session with a blank or
      placeholder reason.
- [ ] **Minors only with guardian consent or an open incident.** For every
      subject < 18, the basis is `GUARDIAN_CONSENT` (on file in
      `consent_ledger`) **or** `OPEN_INCIDENT`. A minor session with basis
      `JUSTIFICATION_TICKET` or `PLATFORM_OVERRIDE` is a **red flag** — those
      bases must never apply to a minor (ADR 0038 §4).
- [ ] **No admin target without break-glass.** Any session whose subject is
      an admin was started by a `platform_admin` and carries a documented
      `BREAK_GLASS` code. A district/school admin targeting an admin should be
      impossible (it would be a `403` at `start`); if one appears, escalate.
- [ ] **Writes-on sessions justified.** For every session with
      `imp_writes_ok = true`, confirm the justification, and review the
      `write_allowed` events — each write hit an allowlisted route and is
      explained by the reason/ticket. Investigate any `write_blocked` cluster
      (someone attempting writes the guard refused).
- [ ] **TTLs within policy.** Clamped TTL ∈ [tenant floor (≥ 5 min), 30 min];
      default 15 min when unspecified. No session ran past its `imp_exp`
      (any `expired` event means the guard correctly cut it off — fine; a
      session that somehow _acted_ after `imp_exp` is a red flag).
- [ ] **No anomalous frequency per actor.** Compare each acting admin's
      session count and total impersonated time to their baseline and to
      peers. Spikes, off-hours bursts, or one admin impersonating an unusual
      breadth of subjects warrant a closer look.
- [ ] **Attribution intact.** Every impersonated request carries `act` (real
      admin) distinct from `sub`; no action is attributed solely to the
      subject.
- [ ] **Tenant policy honoured.** No sessions exist for tenants that have
      impersonation globally disabled.

## 3. Red flags & escalation

Escalate to the Security lead **immediately** (do not wait for sign-off) on
any of:

- A **minor** session without `GUARDIAN_CONSENT`/`OPEN_INCIDENT`.
- An **admin-target** session without a documented `BREAK_GLASS` code, or by
  a non-platform actor.
- A session lacking a reason or a recorded consent basis.
- Impersonated activity **after** `imp_exp` (suggests a guard bypass).
- A `write_allowed` to a route **not** on that service's
  `imp-write-allowlist.ts` (suggests guard/allowlist drift).
- Any **anomalous-frequency** actor, or sessions on a tenant that disabled
  impersonation.
- A broken audit chain (`/events/verify`) covering the review window.

Escalation path: Security lead → revoke the actor's sessions + rotate
credentials (identity-svc) → open a SEV-appropriate incident
(`docs/runbooks/incident-response.md`) → if minor data or unlawful access is
implicated, trigger the privacy/DPO breach process.

## 4. Evidence retention

- Retain the month's `GET /api/impersonation/history` export, the
  `auth.impersonation.*` ndjson export, the completed checklist, and any
  escalation tickets, for **≥ FERPA 7 years** (align to the tenant's
  `audit_retention_policy`, ADR 0032).
- The underlying audit events are already in the **tamper-evident,
  append-only** chain with daily WORM anchors — do not copy them out as the
  system of record; reference them by `imp_sid` / `request_id`.
- Store the signed-off review record in the security register and link it
  from the SOC 2 evidence index.

## 5. Sign-off template

```markdown
# Impersonation Compliance Review — <YYYY-MM>

- Period: <month start> → <month end> (UTC)
- Reviewer: <name, role>
- Data pull by: <name> on <date>
- Sources: impersonation/history + auth.impersonation.\* audit
- Audit chain verified: yes / no (/events/verify result)

## Summary

- Total sessions: <n>
- Distinct acting admins: <n>
- Writes-on sessions: <n>
- Minor-subject sessions: <n> (all guardian-consent / open-incident? yes/no)
- Admin-target sessions: <n> (all break-glass? yes/no)

## Checklist outcome

- [ ] Reason + valid basis on every session
- [ ] Minors only with guardian consent / open incident
- [ ] No admin target without break-glass
- [ ] Writes-on sessions justified; write_allowed all allowlisted
- [ ] TTLs within policy; no post-expiry activity
- [ ] No anomalous frequency per actor
- [ ] Attribution intact (act ≠ sub on every request)
- [ ] Tenant-disable honoured

## Findings / red flags

- <none | description + escalation ticket link>

## Disposition

- Result: PASS / PASS WITH FINDINGS / FAIL (escalated)
- Sign-off: <name> <signature/SSO> <date>
```

## Notes

- A gap in the per-request feed is not, by itself, evidence of a hidden
  session — producers emit best-effort (ADR 0032). Corroborate the history
  table against the audit events and the chain before concluding tampering.
- Hash-chain proof is platform/district only; school admins see events but
  not the proof (RBAC, ADR 0032). Run this review at platform scope.
