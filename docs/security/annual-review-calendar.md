# Annual Security Review Calendar

Sprint 16. Owner: Security lead.
Operationalises the recurring obligations in
`docs/security/soc2-control-matrix.md`.

## At-a-glance

| Quarter | Activity                                | Owner                | Output                                                        |
| ------- | --------------------------------------- | -------------------- | ------------------------------------------------------------- |
| Q1 (Jan)| Policy review                           | Security lead + Counsel | Refreshed `docs/security/*.md` + ADR update if needed       |
| Q1 (Feb)| Annual risk assessment                  | Security lead        | Updated `docs/security/threat-model.md`                       |
| Q2      | Penetration test                        | External vendor      | `docs/security/pentest-<YYYY>-<QQ>.md`                        |
| Quarterly | Disaster Recovery drill               | SRE on-call          | `scripts/dr/results/<UTC>.json` (also dry-run via CI cron)    |
| Q3      | Security training refresh               | People Ops + Security| Updated rows in `docs/security/training-records/template.csv` schema; quarterly CSV export to evidence vault |
| Q4      | SOC 2 audit (Type II observation window) | Security lead + Counsel | Auditor report; refreshed control matrix evidence links     |
| Quarterly | Incident response tabletop            | Security on-call     | Dry-run post-mortem under `docs/runbooks/post-mortems/`       |
| Quarterly | Sub-processor / DPA review            | Counsel              | Updated `docs/dpa-management.md`                              |
| Quarterly | Key rotation review                   | Security lead        | `docs/security/key-rotation.md` updates + KEK/JWT rotation evidence |
| Monthly | Access review                           | Engineering Lead     | Confirmed RBAC matches HR active-employee list                |

## Detailed cadence

### January — policy review

Re-read every document under `docs/security/`. For each, decide:

- Still accurate? Stamp the front matter `Reviewed: YYYY-01`.
- Stale? Open a PR to update.
- Superseded? Move to `docs/security/archive/` (create dir if needed).

Update `docs/adr/0021-soc2-readiness.md` with the current auditor and
observation window.

### February — risk assessment

1. Re-run the asset table in `docs/security/threat-model.md`.
2. For each asset, re-rate likelihood + impact.
3. List new risks discovered in the past year (incidents,
   near-misses, audit findings).
4. Sign-off in the threat-model file footer.

### Q2 — penetration test

External vendor engagement. Scope: production stack + the four
destructive admin surfaces called out in the SOC 2 matrix
(`tenant:delete`, `user:delete`, `tenant:suspend`, `data:export`).
Output committed at `docs/security/pentest-<YYYY>-<QQ>.md` with
remediation tickets linked.

### Quarterly — DR drill

Scheduled via `.github/workflows/quarterly-dr-drill.yml` (cron on the
1st of Jan, Apr, Jul, Oct in `--dry-run` mode). SRE on-call ALSO runs
a non-dry-run drill at least once per quarter and uploads the report
to the evidence vault. Release-gate requires a report < 90 days old.

### Q3 — training refresh

People Ops kicks off the annual training cycle. Each employee
completes the required courses from
`docs/security/training-records/README.md`. CSV export at end of Q3
goes to the evidence vault.

### Q4 — SOC 2 audit

Auditor's observation window ends. Security lead packages evidence:

- Control matrix (`docs/security/soc2-control-matrix.md`) with
  evidence links updated for the period.
- Pentest report (Q2).
- DR drill reports (quarterly).
- Training records (Q3 export).
- IR post-mortems for the period.
- Sample audit chain hashes.

### Quarterly — IR tabletop

IC + Comms + Ops run one scenario from
`docs/security/incident-response-runbook.md` § 5. Output: a dry-run
post-mortem at `docs/runbooks/post-mortems/INC-DRILL-<YYYY-QQ>.md`
plus any runbook deltas.

### Quarterly — DPA review

Counsel re-verifies each sub-processor in the DPA store
(`services/data-governance-svc/src/services/dpa-store.ts`). Confirm:
contract still valid, breach history clean, sub-processor list
unchanged. Update `docs/dpa-management.md`.

### Quarterly — key rotation review

Walk the inventory in `docs/security/key-rotation.md`. Confirm:

- No key is past its rotation cadence.
- Vault contains both `vN-1` and `vN` for active rotations.
- Migration jobs (re-encryption with new KEK) are complete or
  on-schedule.

### Monthly — access review

Engineering Lead pulls the SSO + RBAC roster, diffs against the HR
active-employee list, and revokes mismatches. Output: a row in the
internal access-review ledger.

## Gate enforcement

The Sprint 16 `scripts/release-gate.mjs` reads from this calendar's
artifacts:

- `dr:drill-within-90d` — quarterly DR drill output
- `security:reviews-signed` — sprint-level security reviews
- `soc2:matrix-zero-todos` — control matrix
- `feature-flags:100pct-staging-72h` — release-readiness gate

When any quarterly artifact is missing, the corresponding gate fails
the next production release attempt.
