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
