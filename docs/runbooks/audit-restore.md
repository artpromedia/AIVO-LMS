# Runbook — Audit Log Restore

**Audience:** Platform on-call · **Severity:** P2 · **Last reviewed:** Sprint 11

Use this when `pnpm --filter @aivo/admin-svc test:audit-chain` (or the
`/api/admin-svc/audit-log/verify` endpoint) reports a chain break in
`admin_audit_log`. The append-only triggers added in Sprint 4 should
make tampering practically impossible, but a botched migration or a
storage corruption event can still break the hash chain.

## Diagnose

1. Hit the verify endpoint as PLATFORM_ADMIN:

   ```bash
   curl -H "Authorization: Bearer $TOKEN" \
        https://admin.aivolearning.com/api/admin-svc/audit-log/verify
   ```

   The response includes `firstBrokenSeq` (the row whose `prevHash`
   does not match the previous row's `hash`).

2. Pull the surrounding rows:

   ```sql
   SELECT seq, action, actor_email, prev_hash, hash, created_at
     FROM admin_audit_log
    WHERE seq BETWEEN $first_broken - 5 AND $first_broken + 5
    ORDER BY seq;
   ```

   A row whose `prev_hash` doesn't match the prior row's `hash`, *or*
   whose `hash` doesn't match `sha256(prev_hash || canonical_json(row))`,
   is the corruption point.

## Restore from nightly evidence

The nightly SOC 2 evidence bundle (`evidence_bundles` table) contains
`audit-merkle.json` with `latestSeq` + `latestHash` from each day. Use
the most recent bundle whose `latestSeq` is **less than**
`firstBrokenSeq` as your trusted anchor.

1. Download the trusted bundle from `/dashboard/admin/compliance/evidence`
   (PLATFORM_ADMIN + step-up `data:export`). Verify its sha256 against
   the hash recorded in the row.

2. Restore the audit table from the most recent backup that is
   *older than* `firstBrokenSeq`:

   ```bash
   pg_restore --table admin_audit_log --data-only \
     --dbname "$DATABASE_URL" /backups/$BACKUP_FILE
   ```

3. Re-verify:

   ```bash
   curl -H "Authorization: Bearer $TOKEN" \
        https://admin.aivolearning.com/api/admin-svc/audit-log/verify
   ```

   Expect `valid: true`.

## Backfill missing rows

If the restore drops legitimate rows newer than the chain break, the
operations performed during that window are unrecoverable from the
audit chain itself. Pull replacement evidence from:

- Application logs (`identity-svc`, `admin-svc`) shipped to your log
  store — these include the same actor + action context.
- Stripe / IdP / SCIM provider logs for any third-party-side mutations.

Insert reconstructed rows at the next available `seq`, prefixed with
`RECONSTRUCTED:` in the `details` JSON, so auditors can see the chain
gap was closed manually.

## Postmortem requirements

A chain break is automatically a SOC 2 reportable event:

- File the postmortem within 48h.
- Attach the corrupted-row diff and the trusted-bundle sha256.
- Add a one-line entry to `docs/security-architecture.md §1.7` so
  future audits surface the incident.
