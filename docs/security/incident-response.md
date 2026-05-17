# Incident response runbook (Sprint 16)

## Severity levels

| Sev | Definition | Page on-call | First response |
|---|---|---|---|
| SEV-1 | active data exposure / auth compromise / total outage | yes, immediately | < 15 min |
| SEV-2 | partial outage / suspected exposure / AI safety flood | yes | < 30 min |
| SEV-3 | degraded UX / single-customer issue | next business day | < 4 h |
| SEV-4 | cosmetic / planned-fix | no | next sprint |

## Detection sources

- `ops-alerts` (PagerDuty / Slack webhook)
- `status-page-svc` health checks
- `audit-svc` anomaly thresholds (login.failure spike, mock-auth
  spoofing attempts, consent.revoked spike, fallback-rate spike)
- Customer support tickets
- Bug-bounty / responsible-disclosure inbox

## SEV-1 response sequence

1. **Acknowledge** — on-call accepts the page; declares incident in
   the incidents channel; opens a Zoom bridge.
2. **Contain** — first action is to reduce blast radius:
   - revoke compromised credentials
   - rotate any leaked secret (see
     `docs/runbooks/secret-history-rotation.md`)
   - flip the relevant feature flag OFF
   - block the offending IP / actor at the WAF
3. **Eradicate** — fix the underlying defect; deploy the fix through
   the production-gates workflow (no `--no-verify` shortcuts).
4. **Recover** — restore from the most recent verified backup if
   needed; replay the audit chain to confirm integrity.
5. **Notify** — within statutory timelines (FERPA / state privacy
   laws — see `docs/compliance/state-privacy-matrix.md`).
6. **Postmortem** — within 5 business days. Use the template below.

## Customer communication templates

Templates live in `services/comms-svc/src/lib/templates.ts`:

- `admin_alert` — broadcasts an admin-facing notice
- `iep_progress_report_sent` — operational confirmation
- `internal_billing_alert` — internal-only

For incident-specific external comms, use the bespoke template
spec: `internal/admin-alert` with `severity`, `headline`,
`detail`, `impactSummary`, `mitigationStep`, `nextUpdateAt`.

## Breach notification

For confirmed exposure of personally identifying child data
(COPPA / FERPA / state laws):

1. Identify scope (which tenants, which learners, what data).
2. Counsel + compliance review (statutory timing varies — see
   `docs/compliance/state-privacy-matrix.md`).
3. District / school notice via the admin contact on file.
4. Parent notice via comms-svc `iep_update`-style template
   instantiated with breach context.
5. File required regulator notifications.
6. Public statement (if scoped by counsel).

## Postmortem template

```
Title: <SEV>-N <summary>
Date: <UTC>
Lead: <name>
Severity: SEV-N
Detection: <how + when>
Response: <ack time, mitigation time, recovery time>
Root cause: <what>
Contributing factors: <list>
Impact: <users / tenants / data / dollars>
What went well: <list>
What went poorly: <list>
Action items:
  - [ ] (owner) prevention
  - [ ] (owner) detection improvement
  - [ ] (owner) response improvement
Lessons learned: <prose>
```

Postmortems land at `docs/postmortems/<date>-<slug>.md`.

## Operational runbooks (linked)

- `docs/runbooks/admin-break-glass.md` — emergency admin access
- `docs/runbooks/audit-restore.md` — DB + audit chain restore drill
- `docs/runbooks/secret-history-rotation.md` — rotation procedure
- `docs/runbooks/scheduled-check-alerts.md` — health-check alerting
- `docs/runbooks/web-v2-deployment.md` — Next.js app deployment
- `docs/runbooks/web-dashboard-deployment-decision.md` — go/no-go

## RPO + RTO targets

| Tier | RPO | RTO |
|---|---|---|
| Auth / billing | ≤ 1 h | ≤ 1 h |
| Learner data / IEP | ≤ 4 h | ≤ 4 h |
| Marketing / blog | ≤ 24 h | ≤ 4 h |
| Audit chain | 0 (synchronous append) | ≤ 1 h |
