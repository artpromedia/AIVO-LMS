# Disaster Recovery Runbook

Sprint 16. Owners: SRE on-call, Security on-call.
Pair-doc with `docs/security/incident-response-runbook.md`.

## 1. Recovery objectives

| Metric | Target | Measured by                                            |
| ------ | ------ | ------------------------------------------------------ |
| RTO    | < 1 h  | Wall-clock from restore start → readiness check green |
| RPO    | < 5 min| `audit_lag_seconds` in the drill report                |

Both targets are enforced programmatically by
`scripts/dr/backup-restore-drill.sh` — a drill that exceeds either
fails CI and the run.

## 2. What we drill

1. **PITR restore** of the primary Postgres cluster from
   pgBackRest WAL + base backup into a clean target cluster.
2. **Validation queries** under `scripts/dr/drill-queries.sql`:
   - Row counts of `users`, `tenants`, `learners`, `iep_documents`,
     `consents`, `audit_events`.
   - FK integrity: zero orphan learners / sessions.
   - Audit chain continuity:
     `audit_events_with_prev_hash == audit_events_count - 1`.
   - Observed RPO: lag between drill start time and the most recent
     `audit_events.occurred_at`.
3. **Report emission** to `scripts/dr/results/<timestamp>.json`.

The drill does NOT touch the production cluster and does NOT replace
backups — it only validates them.

## 3. Who runs it

| When                  | Who                  | How                                                                  |
| --------------------- | -------------------- | -------------------------------------------------------------------- |
| Quarterly (scheduled) | GitHub Actions cron  | `.github/workflows/quarterly-dr-drill.yml` runs in `--dry-run` mode   |
| Quarterly (real)      | SRE on-call          | Manually trigger workflow_dispatch with `dry_run=false`              |
| Pre-major-release     | Release Eng          | Same workflow_dispatch                                                |
| After incident        | IC                   | Manually trigger to confirm post-incident integrity                  |
| Local rehearsal       | Any engineer         | `scripts/dr/backup-restore-drill.sh --target smoke-test --dry-run`   |

The cron is dry-run only so a scheduled run that fires unattended on a
holiday weekend does not page anyone — it just refreshes the report
freshness for the `release-gate` 90-day window. SRE runs the real
restore at least once per quarter on a chosen day.

## 4. Where reports go

- Local: `scripts/dr/results/<UTC-timestamp>.json` (gitignored beyond
  the seed files committed alongside this runbook).
- CI: uploaded as the `dr-drill-report` artifact on each workflow run.
- Release-gate: `scripts/release-gate.mjs` reads the directory and
  fails the gate if the newest report is more than 90 days old.

## 5. Recovery procedure (real outage)

For an actual production outage, follow this sequence — these steps
are a superset of what the drill exercises:

1. **Declare incident** (see `docs/security/incident-response-runbook.md`).
2. **Identify last known good** — query pgBackRest stanza for the most
   recent good WAL segment.
3. **Provision restore target** — fresh Postgres cluster sized 2x the
   production primary (room to run integrity queries without IO
   pressure on the restored data path).
4. **Issue restore command**:
   ```
   pgbackrest --stanza=aivo --type=time \
     --target='YYYY-MM-DD HH:MM:SS UTC' \
     --target-action=promote restore
   ```
5. **Run validation queries** — `psql -f scripts/dr/drill-queries.sql`.
6. **Cutover** — point services at restored cluster via the connection
   string in Hetzner Vault. Roll services one at a time.
7. **Audit chain check** — `pnpm --filter @aivo/security exec
   ts-node packages/security/src/audit-chain.ts verify` on a recent
   range.
8. **Customer comms** — per IR runbook § 4.
9. **Post-mortem** — per IR runbook § 6.

## 6. Failure modes the drill catches

| Failure                                   | Detection                                         |
| ----------------------------------------- | ------------------------------------------------- |
| Backup corrupt                            | Restore step exits non-zero                       |
| WAL gap                                   | PITR fails to reach requested timestamp           |
| Audit chain tampered                      | `audit_events_with_prev_hash` mismatch            |
| FK integrity lost during restore          | Orphan counts > 0                                 |
| Drill itself slower than RTO              | `rto_seconds > rto_limit_seconds`                 |
| Replication lag > RPO before drill        | `rpo_observed_seconds > rpo_limit_seconds`        |

## 7. Cross-references

- `scripts/dr/backup-restore-drill.sh` — the driver script
- `scripts/dr/drill-queries.sql` — validation query set
- `.github/workflows/quarterly-dr-drill.yml` — CI cron + dispatch
- `.github/workflows/backup-verify.yml` — daily backup health check
- `docs/security/soc2-control-matrix.md` § A1 Availability
- `docs/security/incident-response-runbook.md` § 5
