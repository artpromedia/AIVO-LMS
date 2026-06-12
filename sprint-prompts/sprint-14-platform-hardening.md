# Sprint 14 — Platform hardening: Postgres RLS backstop, audited-by-default writes, dead package removed

## Goal

At the end of this sprint, tenant isolation no longer depends solely on every service remembering its `WHERE tenant_id = …` clause: **Postgres row-level security policies exist on the core tenant-scoped tables, enforced for a new non-bypassing runtime role, with `family-svc` running on that role end-to-end in the compose environment** and a chaos test proving an unscoped query returns zero rows. Service write-routes become **audited by default** via a CI gate (wrapper or explicit exemption), with `family-svc` fully compliant as the reference. The deprecated, importer-less `@aivo/ops-alert` package is deleted. Closes audit gap **M10 (⚠️)** (§E: "no Postgres RLS backstop — a single forgotten WHERE is the failure mode"; "audit coverage is selective"; dead-dep row).

## Context

- **Tenancy today (verified):** `tenant_id` FKs on core tables — `packages/db/src/schema/users.ts:15-27`, `packages/db/src/schema/learners.ts:16-43`; schools/districts in `packages/db/src/schema/{district,districts}.ts` (inspect both — naming overlaps); sessions table referenced from identity flows. Isolation is app-layer Drizzle `WHERE` clauses (e.g., `services/identity-svc/src/routes/sso.ts:259-263`, `services/family-svc/src/auth.ts:75-88`). Migrations live under `packages/db/drizzle/` (generated; excluded from lint) with the workspace's standard `db:migrate` flow — find the migration-authoring convention in `packages/db` (drizzle-kit config) and follow it.
- **Why scoped rollout:** ~30 services share these tables. Flipping RLS to fail-closed for *owner* connections would break everything at once. The correct single-session slice: policies + a dedicated `app_runtime` role (no `BYPASSRLS`) + a tenant-context helper + **one service (family-svc) migrated and proven in compose**, plus a written rollout playbook for the rest. Real enforcement, honestly scoped — not a repo-wide flag-flip.
- **Compose environment:** `docker-compose.e2e.yml` boots `postgres` (`:11`), `identity-svc` (`:49`), `admin-svc` (`:242`), `web-admin` (`:277`), etc. CI job `sprint12-e2e` (`.github/workflows/ci.yml:742`). Check whether `family-svc` is in the compose file; if absent, add it following the existing service-block pattern (env, healthcheck, jwt-keys volume).
- **Testcontainers precedent:** `@testcontainers/postgresql` is already used in this repo (web-v2 persistence tests — `apps/web-v2/lib/db/persistence/__tests__/`); use the same pattern for the RLS policy tests in `packages/db`.
- **Audit machinery (verified):** `packages/audit-client/src/audited.ts:49` exports `audited(action, opts)` route decoration; `auditEventInputSchema` in `src/schema.ts:33-43`; audit-svc persists hash-chained events. Adoption is uneven — many service write-routes don't call it.
- **Dead package (verified):** `packages/ops-alert` is marked deprecated in its own `package.json:5` ("v2.1 §9.1 dedup: use @aivo/ops-alerts") and has **zero importers** (repo-wide grep matched only its own package.json). Successor `packages/ops-alerts` is in active use.
- **CI gate precedents:** `scripts/ci/{check-no-coming-soon,bundle-budget,check-file-length}.mjs` + JSON baselines; gates run in the `lint-and-typecheck` or `repo-tests` jobs.

## Work orders

### DELETE
1. `packages/ops-alert/` — the entire package. Then: repo-wide grep `@aivo/ops-alert` (exact, with quote boundary so `ops-alerts` doesn't match) → must be zero outside the lockfile; run `corepack pnpm install` to regenerate `pnpm-lock.yaml`; check `turbo.json` and any tsconfig references for stragglers.

### CREATE
1. **Migration** in `packages/db` (authored per the package's drizzle convention):
   - `CREATE ROLE app_runtime LOGIN …` (password via env in compose; never hardcoded — wire through the compose env pattern other services use) with `GRANT` of the needed DML on the application schema; **no** `BYPASSRLS`.
   - `ALTER TABLE … ENABLE ROW LEVEL SECURITY` on the core set: `users`, `learners`, plus the school/district membership tables identified from the schema inspection (enumerate in the checkpoint).
   - Tenant policy per table: `USING (tenant_id = current_setting('app.tenant_id', true)::uuid)` (and `WITH CHECK` mirror for writes). Tables where `tenant_id` is nullable for platform-level rows get an explicit additional policy decision — inspect data semantics first and document the choice per table in the migration comments.
   - Owner/migration connections are unaffected (RLS without `FORCE` doesn't bind table owners) — state this in the migration header so future readers understand the rollout model.
2. `packages/db/src/tenant-context.ts` — `withTenantContext(db, tenantId, fn)`: opens a transaction, `SET LOCAL app.tenant_id = <validated uuid>`, runs `fn`, ensuring the setting cannot leak across pooled connections (SET LOCAL + transaction scope). Export + unit-type it. Also `withoutTenantContext` for explicitly platform-scoped operations (named loudly; takes a `reason: string` argument that is logged).
3. `packages/db/src/__tests__/rls-policies.test.ts` — Testcontainers Postgres: run migrations; as `app_runtime` **without** context → `SELECT` on `users`/`learners` returns 0 rows despite seeded data; **with** `withTenantContext(tenantA)` → only tenant-A rows; cross-tenant write with mismatched `tenant_id` → rejected by `WITH CHECK`. As owner role → unaffected (documents the rollout model).
4. `scripts/ci/check-audited-writes.mjs` + `scripts/ci/audited-writes-baseline.json` — static scan of `services/*/src/routes/**`: every POST/PUT/PATCH/DELETE route registration must either reference the `audited(` wrapper (or the service's established audit call — detect both patterns; read 2-3 services first to learn the shapes) or carry an `audit-exempt(<reason>)` marker. Baseline JSON records today's non-compliant count **per service**; the gate fails if any service's count rises. Wire into CI (`repo-tests` job), no `continue-on-error`.
5. `docs/security/rls-rollout.md` — the playbook: per-service steps (switch `DATABASE_URL` role → wrap request handlers with `withTenantContext` from the auth middleware where tenant is resolved → run service suite → compose verify), the table coverage list, and the explicit current state (family-svc done; others pending). This document describes **shipped reality plus concrete next steps** — no aspirational claims.

### REFACTOR
1. `services/family-svc` — the reference adoption:
   - its auth layer already resolves tenant (`src/auth.ts:33-88`); thread `withTenantContext` around request handling so every DB call runs inside tenant context (find the cleanest seam — Fastify hook or per-route — after reading how the service builds its db handle);
   - its compose/service config switches to the `app_runtime` role;
   - wrap its currently-unaudited write routes with `audited(...)` (census them; the whats-working/interests/iep/collaboration routes are the known surface) — bringing family-svc's baseline entry to **zero**.

### EDIT
1. `docker-compose.e2e.yml` — `family-svc` service block (if missing) + the `app_runtime` credentials env; ensure the migration job/entrypoint creates the role before services start (follow how the compose file sequences `jwt-keygen`/migrations today).
2. `.github/workflows/ci.yml` — add the audited-writes gate step.
3. `README.md` security section — two lines: RLS backstop status + the audited-writes gate.

## Implementation standard

- Everything must work end-to-end. No placeholders, stubs, mocks outside of test files, TODOs, FIXMEs, hardcoded sample data standing in for real logic, empty function bodies, `not implemented` errors, or "in a real implementation…" comments.
- Real integrations only: actual database reads/writes, actual scheduler/job registration, actual Orchestrator and Learning Brain wiring.
- Before declaring done, grep all changed files for `TODO|FIXME|stub|placeholder|mock|not implemented|coming soon` and resolve every hit in production code.

## Definition of done

1. `corepack pnpm --filter @aivo/db test` green including `rls-policies.test.ts` (Testcontainers) — the zero-rows-without-context assertion is the headline.
2. Compose: `family-svc` boots on `app_runtime`, its endpoints serve correct tenant-scoped data (exercise `GET /api/family/whats-working/:learnerId` via the existing harness or a curl with a seeded token), and flipping its role back to owner is **not** needed for green — i.e., RLS-enforced service passes its own test suite (`corepack pnpm --filter @aivo/family-svc test`).
3. `node scripts/ci/check-audited-writes.mjs` green; family-svc baseline = 0; negative proof: add a scratch unaudited POST route → gate fails → remove.
4. `@aivo/ops-alert` gone: dir absent, grep clean, `corepack pnpm install` lockfile regenerated, `corepack pnpm -r typecheck` (or the repo's standard turbo typecheck) green.
5. Full repo test command used by CI (`pnpm test` per `repo-tests`) green.

## Tests

- New: RLS policy tests; family-svc audit-coverage assertions (extend its route tests to assert an audit event is emitted on a representative write — follow audit-client's test utilities if present).
- Run: full `packages/db` + `family-svc` suites; repo-wide typecheck; compose lane if locally runnable (state which).

## Out of scope

- Migrating the other ~29 services to `app_runtime`/tenant-context (playbook documents the path; each is future work). `FORCE ROW LEVEL SECURITY`. Key-rotation policies, analytics ADR, admin i18n (decision-gated). Schema changes beyond RLS policies/role. Touching `ops-alerts` (the successor) beyond confirming it's the import target.

## Depends on

Nothing hard (services/db only; no UI overlap). Run anytime; ordered late to keep early sprints user-visible.

## Checkpoint

Summarize: tables covered + per-table policy decisions, the family-svc seam chosen for tenant-context, chaos-test output (zero-rows proof), audited-writes baseline JSON (per-service counts), ops-alert removal diff summary. **Pause for owner review. Do not commit, stage, or push unless explicitly instructed.**
