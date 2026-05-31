# Runbook: Postgres persistence cutover & operations

Covers the `apps/web-v2` persistence layer: switching domains from the
default in-memory store to Postgres, the row-level-security model,
backups/PITR, and migration/rollback. See ADR 0002 (RLS), ADR 0007
(adapter boundary), ADR 0013 (disaster recovery), ADR 0015 (web-domain
tables).

## Modes

`AIVO_PERSISTENCE` (and per-domain `AIVO_PERSISTENCE_<DOMAIN>`) select
`memory` (default) or `postgres` per domain. Memory is process-local
(dev, tests). Postgres is durable, multi-instance, backed by the
`web_*` / `lesson_*` / `learner_brain_profiles` tables.

## One-time cutover for an environment

1. **Provision Postgres** (managed, with automated backups + WAL
   archiving — see Backups below). Capture `DATABASE_URL`.
2. **Apply migrations** (owner role):
   ```bash
   DATABASE_URL=… pnpm --filter @aivo/db run db:migrate
   ```
   This applies through `0050_web_domain_rls` (tables + RLS policies +
   the `aivo_app` role).
3. **Seed reference + demo data** (owner role):
   ```bash
   AIVO_SEED_DATABASE_URL=… pnpm --filter @aivo/web-v2 db:seed:postgres
   ```
   Idempotent on natural keys; run once on a fresh DB. Reuses
   `ensureSeeded()` so postgres matches memory exactly.
4. **Create the enforced app login role** and point the app at it:
   ```sql
   CREATE ROLE aivo_app_login LOGIN PASSWORD '…';
   GRANT aivo_app TO aivo_app_login;   -- inherits DML grants, NOT owner
   ```
   Set the **app**'s `DATABASE_URL` to `aivo_app_login` (NOT the owner).
   Migrations/seed/analytics keep using the owner URL.
5. **Flip domains incrementally**: set `AIVO_PERSISTENCE_<DOMAIN>=postgres`
   one domain at a time (start with low-risk: `notifications`, `audit`,
   `quests`), watch under load, then proceed. Flip the global
   `AIVO_PERSISTENCE=postgres` only after every domain is verified.
6. **Roll back** a domain at any time by setting its flag back to
   `memory` (data already written stays in Postgres).

## Row-level security (tenant isolation)

- RLS is enabled on every tenant-scoped table with a `tenant_isolation`
  policy keyed on the GUC `app.current_tenant` (ADR 0002).
- The **table owner bypasses RLS** — migrations, seed, and cross-tenant
  analytics use the owner connection.
- **Application traffic must run as `aivo_app`** (a non-owner role) for
  the policy to be enforced, and must set the tenant per request:
  ```ts
  import { withTenantContext } from "@/lib/db/persistence/drizzle/client";
  await withTenantContext(session.tenantId, async (db) => {
    /* adapter calls */
  });
  ```
  `withTenantContext` wraps the work in a transaction that runs
  `set_config('app.current_tenant', <tenant>, true)`. With no tenant set,
  `aivo_app` sees zero rows (fail-closed).
- Cross-tenant/internal-admin reads (`listForTenants`,
  `recentForTenants`, `listUsersForTenants`) use the privileged owner
  connection, which bypasses RLS by design.
- **Proof:** `lib/db/persistence/__tests__/rls.postgres.test.ts` asserts
  `aivo_app` sees only its tenant, cannot write across tenants
  (`WITH CHECK`), and sees nothing with no tenant set. It runs in CI's
  `persistence-contract` job against a real Postgres.

## Backups & point-in-time recovery (ADR 0013)

- Use the managed provider's **daily base backup + continuous WAL
  archiving** to enable PITR. Target **RPO ≤ 5 min, RTO ≤ 1 h**.
- Retention: 30 days of PITR window; 90 days of weekly snapshots.
- **Restore drill** quarterly: restore to a scratch instance, run
  `pnpm --filter @aivo/db run db:migrate` (no-op if current), then the
  persistence row check:
  ```bash
  AIVO_VERIFY_SEEDED=1 DATABASE_URL=… node scripts/ci/verify-postgres-rows.mjs
  ```
  It asserts every `web_*` / lesson / brain table exists and (with
  `AIVO_VERIFY_SEEDED=1`) that the reference tables came back non-empty.
- CI runs the same script (schema mode) in the `persistence-contract`
  job after `db:migrate`, so migration drift on these tables fails the
  build. Add `verify-postgres-rows.mjs` (seeded mode) to
  `backup-verify.yml`'s post-restore checks when this DB goes live.

## Migrations & schema drift

- Migrations are forward-only Drizzle SQL in `packages/db/drizzle`,
  tracked by `meta/_journal.json`; applied by `db:migrate`.
- `db-schema-drift.yml` fails CI if the committed schema and migrations
  diverge — regenerate/commit migrations with any schema change.
- **Reverting RLS** (emergency): connect as owner and
  `ALTER TABLE <t> DISABLE ROW LEVEL SECURITY;` per table, or point the
  app back at the owner `DATABASE_URL` (owner bypasses RLS) while
  investigating. Prefer the latter — it is instant and reversible.

## Verification checklist before flipping the global default

- [ ] `pnpm persistence:stubs` → 0 stubs.
- [ ] CI `persistence-contract` green (all 11 store contracts + RLS
      against real Postgres).
- [ ] Seed ran; reference reads (subjects, quests, policies) non-empty.
- [ ] App configured with the `aivo_app` login role + `withTenantContext`
      on hot paths.
- [ ] Backup + PITR enabled and a restore drill passed.
