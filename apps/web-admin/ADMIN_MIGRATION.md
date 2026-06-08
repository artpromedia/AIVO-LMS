# web-admin migration tracker

Admin no longer lives in `apps/web-v2`. The full admin console is being rebuilt
in this standalone `apps/web-admin` app, where pages are thin server components
that call the shared `@aivo/admin-api` package (backed by `admin-svc`), gate with
`@aivo/admin-auth`, and render with `@aivo/admin-ui`.

This file tracks which admin pages have landed and what remains.

## Architecture

| Concern | Source |
| --- | --- |
| Backend / BFF clients | `@aivo/admin-api` (`packages/admin-api`) → `/api/admin-svc/*` |
| Auth / RBAC / MFA | `@aivo/admin-auth` (`requirePlatformPage`, `requirePageRole`) |
| Shared UI primitives | `@aivo/admin-ui` (`AdminPageFrame`, `AdminCard`, `AdminMetricCard`) |
| App-local presentational views | `apps/web-admin/components/*` |

## Done — Wave 1 (backend already exists in `@aivo/admin-api`)

Platform: `system-health`, `tenants`, `tenants/[id]`, `users`, `users/[id]`,
`learners`, `billing`, `compliance`, `audit`, `safety`, `safety/moderation`,
`ai/moderation` (→ redirect), `ai-costs`, `settings`, `settings/api-keys`.

District: `audit`, `billing`, `compliance`.

School: `audit`, `billing`, `compliance`, `learners`.

Already present before this wave: `login`, `login/mfa`, `district` (setup),
`platform`, `platform/districts`, `platform/billing/coupons`,
`platform/billing/trials`, `platform/sales/leads`, `school`.

## Done — Wave 2 (admin-svc backend already existed; added admin-api modules)

- **platform/jobs** ← `@aivo/admin-api/jobs` (`/api/admin-svc/jobs`, `/jobs/freshness`)
- **school/classes (+[classId])** ← `@aivo/admin-api/classrooms` (`/admin/schools/:schoolId/classrooms[/:id]`)
- **district/reports**, **school/reports** ← `@aivo/admin-api/reports`
  (`/admin/schools/:schoolId/reports`, `POST …/reports/:reportId/run`)
- **school/rostering (+import, +template route)** ← `@aivo/admin-api/rostering`
  (`/admin/schools/:schoolId/learners/import/{validate,run,template,:jobId}`)

School-scoped routes derive `:schoolId` from `session.tenantId`.

## Done — Wave 3 (more existing backends surfaced)

- **platform/identity (+[tenantId])** ← `@aivo/admin-api/identity` (district invites,
  resend/revoke) + `@aivo/admin-api/scim` (per-tenant SCIM tokens). Platform-admin only.
- **platform/content (+[id])** ← `@aivo/admin-api/content` (`/api/admin/content-cms/packs`).

## Done — Wave 4 (first full-stack slice: new admin-svc endpoint)

Proves the end-to-end backend-migration pattern for domains with no existing
admin-svc endpoint:

- **platform/feature-flags** — new `admin-svc` route
  `GET /api/admin-svc/feature-flags` (resolves `@aivo/feature-flags` metadata +
  sprint flags against env, ported from web-v2's BFF) → new
  `@aivo/admin-api/feature-flags` module → page. Stateless (env-driven), no DB.

**Pattern for remaining full-stack domains:** (1) add/port the data source into
`admin-svc` (route, and for stateful domains a Drizzle schema + repo +
migration — or a proxy to the real owning service, e.g. `integration-svc` for
SIS), (2) register in `services/admin-svc/src/index.ts`, (3) add an
`@aivo/admin-api/<domain>` module, (4) build the page(s), (5) wire nav. Note:
several web-v2 admin stores (e.g. `lib/db/sis-store`) were **in-memory mocks** —
the real backend is the owning service, so prefer proxying it over copying mock
data.

## Done — Wave 5 (SIS, proxied to the real owning service)

- **district/sis (+[connectionId])** ← new `@aivo/admin-api/sis` module calling
  **integration-svc** directly (the owning service, backed by Postgres
  `integration_connections` / `integration_sync_logs`). Lists a district's
  roster connectors, shows live sync history, and triggers a sync — **no mock
  store; every call hits the live service + DB**. Mirrors the direct-service
  pattern of `identity.ts`. Adds `INTEGRATION_SVC_URL` env helper.

> Policy: **no in-memory mock data** anywhere. Stateful domains connect e2e to a
> real database — via the owning service (preferred) or, where there is no
> owner, new admin-svc Drizzle tables + migrations.

## Done — Wave 6 (DSAR + retention, incl. owning-service DB conversion)

The owning service (`data-governance-svc`) stored DSAR requests and retention
policies in in-memory `Map`s. Converted both to the DB-or-fallback pattern from
`dpa-store.ts` — **Postgres in production** (tables `dsar_requests`,
`dsar_events`, `retention_policies`), `selectXStore(db)` throws in production
without a DB, in-memory only for tests/dev. Then surfaced them:

- **platform/compliance/dsar (+[id])** ← `@aivo/admin-api/dsar` → `data-governance-svc`
  `/dsar` queue (KPIs, SLA state, approve/reject) + detail (timeline,
  verify-identity/approve/reject/fulfill actions).
- **platform/compliance/retention** ← `@aivo/admin-api/retention` →
  `/retention/policies` list + per-data-class edit (retention window,
  disposition, legal hold).

Backend: `data-governance-svc` builds; **37 tests pass**. Frontend: web-admin
typecheck + lint + tests pass.

## Done — Wave 7 (invoices, proxied to billing-svc)

- **district/billing/invoices**, **school/billing/invoices**,
  **platform/billing/invoices** (tenant-scoped via `?tenantId=`, linked from
  tenant detail) ← new `@aivo/admin-api/invoices` module calling **billing-svc**
  directly (Postgres `invoices` table, synced from Stripe). billing-svc was
  already DB-backed, so a straight proxy — no conversion needed. Adds
  `BILLING_SVC_URL` env helper + shared `InvoicesTable`.

## Done — Wave 8 (security posture: new admin-svc-owned Postgres tables)

The keystone "no owning service" pattern. Security data was in-memory in the old
web-v2 admin; built it from scratch e2e to Postgres:

- `@aivo/db`: new `security_controls` + `security_control_evidence` tables
  (`src/schema/security.ts`) and additive migration `drizzle/0075_security_controls.sql`
  (+ journal entry). Hand-written additive migration (drizzle-kit generate was
  blocked by pre-existing unrelated snapshot drift; the migrator applies SQL via
  `_journal.json`).
- `admin-svc`: new DB-backed `routes/security.ts` — list/get/create/update
  controls, platform-admin gated, every write hash-chained into admin_audit_log.
  Builds; 34 service tests pass.
- `@aivo/admin-api/security` module → `platform/security` (coverage overview) +
  `platform/security/controls` (register: add control, set status).

## Done — Wave 9 (security incidents)

Extends Wave 8: new `security_incidents` table + migration `0076`, incident
endpoints added to admin-svc `routes/security.ts` (list/create/update, terminal
status stamps `resolvedAt`, writes audited), `@aivo/admin-api/security` incident
functions, and `platform/security/incidents` (open incident, set status,
SEV1/open KPIs).

## Done — Wave 10 (security risks + vendors + vulnerabilities)

Completes the security domain. New tables `security_risks`, `security_vendors`,
`security_vulnerabilities` + migration `0077`; admin-svc list/create/update
endpoints for each (vuln fixed/wontfix stamps `resolvedAt`; all writes audited);
`@aivo/admin-api/security` functions; pages `platform/security/{risks,vendors,
vulnerabilities}` (register + create + key-field updates), all linked from the
security overview. **Security posture is now fully migrated** (controls,
incidents, risks, vendors, vulnerabilities — all e2e to Postgres).

## Remaining — needs a NEW `@aivo/admin-api` module first

Note: `platform/compliance/{data-inventory,retention}` were attempted but
**dropped** — `admin-svc`'s `governance` route is a DSAR POST subscriber with no
GET read API, so those pages need a new governance read endpoint built first.


Each domain below has reference logic in `apps/web-v2/app/api/bff/admin/*` on
`main` (port from there to keep contracts current, NOT from the stale
`claude/jolly-wozniak-rfdIk` branch).

| Domain | Pages | web-v2 BFF reference |
| --- | --- | --- |
| SIS / integration | platform/sis, district/sis(+new,[id]) | `admin/sis` |
| Security posture | platform/security(+controls,incidents,risks,vendors,vulnerabilities,state-privacy) | `admin/security/*` |
| Curriculum | platform/curriculum(+frameworks,import,skills,subjects,versioning) | `admin/curriculum/*` |
| Compliance ops | platform/compliance/{dsar,retention,disclosures,data-inventory} | `admin/compliance/*` |
| Identity / SSO | platform/identity(+[tenantId]), district/settings/sso | `admin/identity/idp` |
| Feature flags | platform/feature-flags | `admin/feature-flags` |
| Billing ops | platform/billing/{invoices,revenue,daily-batch} | `admin/billing/invoices` |
| AI ops | platform/ai/playground, platform/ai-generation, platform/safety/{policies,red-team,review-queue} | `admin/ai/*` |
| Audio | platform/audio(+pronunciation) | `admin/audio/*` |
| Baseline items | platform/baseline-items | `admin/baseline-*` |
| Migration / jobs / data | platform/{migration,jobs,data} | `admin/migration` |
| Support | platform/support | `admin/support` |
| Settings | platform/settings/{emails,webhooks} | (no BFF yet) |
| District ops | district/{reports,iep,schools,staff,settings/*} | `admin/reports`, `admin/staff` |
| School ops | school/{classes(+[id]),reports,rostering(+import),settings,staff} | `admin/school/*`, `admin/staff` |

## Conventions for new pages

- List page: `requirePlatformPage("...")` or `requirePageRole([...])` → fetch via
  `@aivo/admin-api/<module>` → render with a presentational view in
  `apps/web-admin/components`.
- Mutations: `"use server"` action that re-checks role, then redirects with a
  `?notice=`/`?error=` query param (see `platform/safety/moderation`).
- Reuse `admin-*` CSS utility classes already defined in `app/globals.css`.
