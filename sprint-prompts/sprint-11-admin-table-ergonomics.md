# Sprint 11 — Admin data ergonomics: every core list searchable, sortable, pageable — plus audited bulk actions

## Goal

At the end of this sprint, the admin's core entity lists — **tenants, users, learners, leads** (and invoices where applicable) — run on the same server-driven `DataTable` the audit log already uses: server-side search, column sort, pagination, CSV export. Two high-traffic flows gain **bulk selection with audited, confirmed bulk actions** (district-admin invite revoke; parent-invite revoke/resend). Today only the audit log has these ergonomics; the other lists render every row with no search (verified in `apps/web-admin/components/admin-tables.tsx` + per-page tables). Closes audit gap **M7 (⚠️)** — the Stripe-bar table-stakes gap.

## Context

- **The good pattern to propagate:** `/platform/audit` — page `apps/web-admin/app/platform/audit/page.tsx:15-69` parses `page/q/sort` from `searchParams`, calls `listAdminAuditLogsPage(session, { page, pageSize, search, sort })`, renders `DataTable`. The component: `packages/admin-ui/src/data-table.tsx` (props contract at `:24-48`; sortable headers with `aria-sort` `:137-149`; empty message `:155-160`; pager with `aria-current` `:174-197, :227`; GET-form search; `exportHref` passthrough). Export route pattern: `apps/web-admin/app/platform/audit/export/route.ts:7-23` (session-checked proxy with content-disposition).
- **The lists to migrate (verified render-all today):**
  - Tenants — page `app/platform/tenants/page.tsx` → `listAdminTenants` (`packages/admin-api/src/platform.ts:100-107`) → `TenantsTable` in `apps/web-admin/components/admin-tables.tsx`.
  - Users — `app/platform/users/page.tsx` → `listAdminUsers` (`platform.ts:67-72`) → `UsersTable`.
  - Learners — `app/platform/learners/page.tsx` → `listAdminLearners` → `LearnersTable` (a CSV export route already exists at `app/platform/learners/export/route.ts` — keep it wired into `exportHref`).
  - Leads — `app/platform/sales/leads/page.tsx:1-154` (status filter chips already exist — preserve them as `extraParams` so chips compose with search/sort/paging).
- **Backend reality:** the corresponding `admin-svc` endpoints return full lists today; the audit-log endpoint already accepts paging/search/sort. This sprint **extends the admin-svc list endpoints** (`services/admin-svc/src/` — locate the tenants/users/learners/leads routes) with optional `{ page, pageSize, q, sort }` query params (Drizzle: `ilike` across the columns the UI shows, `orderBy`, `limit/offset`, plus a `total` count). Backward compatible: absent params → current full-list behavior so other callers don't break. Validate params with the service's existing Zod schema pattern.
- **Bulk-action targets (both already have audited single-row server actions to reuse):** district-admin invite revoke on `app/platform/districts/page.tsx`; parent-invite revoke (and resend) on `app/district/parents/page.tsx`. Server-first bulk = plain HTML: a checkbox column (`name="ids"` per row) inside one `<form>` whose submit is a server action iterating ids through the existing per-id admin-api call (each call audits individually — N audit entries is the correct, verifiable behavior). Confirmation via `ConfirmDangerDialog` from Sprint 10.
- **e2e:** root `e2e/specs/admin/*` compose lane (job `sprint12-e2e`, `.github/workflows/ci.yml:742`); seeding patterns inside existing specs (`pilot-provision.spec.ts`, `district-overview.spec.ts`).

## Work orders

### DELETE
1. The bespoke render-all table components that the migration obsoletes in `apps/web-admin/components/admin-tables.tsx` (`TenantsTable`, `UsersTable`, `LearnersTable`, and the leads table markup in the leads page) — **after** their pages are on `DataTable`. Any table in that file still used by an unmigrated page stays.

### CREATE
1. `packages/admin-ui/src/data-table-bulk.tsx` — additive bulk layer for `DataTable`: renders the checkbox column (`<input type="checkbox" name="ids" value={rowKey}>` + a header select-all that is a pure client nicety with a no-JS-safe fallback), and a `BulkActionBar` slot that lives **inside** the same form so submission carries the selection. Keep `DataTable` itself server-compatible; the bulk layer is opt-in via new optional props (`bulk?: { actionBar: ReactNode }`). a11y: checkboxes labeled per row ("Select {name}"), bar announces selection count via `aria-live`.
2. Server-side paging in `admin-svc`: extend the four list routes with `{ page, pageSize, q, sort }` (Zod-validated, capped `pageSize ≤ 100`) returning `{ rows, total, page, pageSize }`. Add service-level tests following `services/admin-svc`'s existing route-test pattern.
3. Paged client functions in `packages/admin-api/src/platform.ts` (and the leads module): `listAdminTenantsPage`, `listAdminUsersPage`, `listAdminLearnersPage`, `listLeadsPage` — same shape as `listAdminAuditLogsPage`. Keep the old full-list functions until no caller remains, then delete them (grep callers).
4. Export routes for tenants/users/leads mirroring `audit/export/route.ts` (learners already has one) — search filter preserved in the export query.
5. `e2e/specs/admin/tables-ergonomics.spec.ts` — compose-lane spec: seed ≥ 3 pages of users (reuse seeding helpers); search narrows server-side (assert the network/URL `q=`), sort toggles `aria-sort`, pagination preserves `q`+`sort`; export link downloads CSV honoring the filter.
6. `e2e/specs/admin/bulk-actions.spec.ts` — select two parent invites → bulk revoke → `ConfirmDangerDialog` → both revoked → audit log contains both entries (reuse `audit-reads.spec.ts` read pattern).

### REFACTOR
1. The four pages onto `DataTable` with `basePath`, `search`, `sort`, `exportHref`, `extraParams` (leads keep their status chips as `extraParams`); columns match what each bespoke table showed today (no information regression — diff the column sets in the checkpoint).
2. `app/platform/districts/page.tsx` + `app/district/parents/page.tsx` — invite lists gain the bulk layer + bulk revoke (parents also bulk resend); each bulk submit confirms via `ConfirmDangerDialog` ("Revoke N invites?") and reports per-row outcome in the `FlashRegion` ("Revoked 2 · 1 already revoked").

### EDIT
1. `packages/admin-ui/src/data-table.tsx` — only the additive props needed for the bulk slot; existing consumers (audit pages) must need **zero** changes (their specs prove it).
2. Page `loading.tsx` files for the migrated routes if absent (mirror `app/platform/loading.tsx` skeleton style — check which exist: `platform/district/school` roots have them).

## Implementation standard

- Everything must work end-to-end. No placeholders, stubs, mocks outside of test files, TODOs, FIXMEs, hardcoded sample data standing in for real logic, empty function bodies, `not implemented` errors, or "in a real implementation…" comments.
- Real integrations only: actual database reads/writes, actual scheduler/job registration, actual Orchestrator and Learning Brain wiring.
- Before declaring done, grep all changed files for `TODO|FIXME|stub|placeholder|mock|not implemented|coming soon` and resolve every hit in production code.

## Definition of done

1. Compose run: `/platform/users?q=<seeded-name>` returns the filtered page **from the server** (verify `total` shrinks, not client filtering); sort by created-at flips order; page 2 link preserves search+sort; CSV export of the filtered set downloads.
2. Bulk: select 2 parent invites → confirm → both gone from the list; `/platform/audit` (or district audit) shows two revoke entries; selecting nothing and submitting is a no-op with a polite flash.
3. Tenants/users/learners/leads pages contain **no** render-all bespoke tables (deleted per DELETE-1); audit-log pages unchanged and their specs green.
4. Commands green: `corepack pnpm --filter @aivo/web-admin typecheck|lint|test`; `corepack pnpm --filter @aivo/admin-svc test` (new route tests); admin-ui tests; compose specs `tables-ergonomics` + `bulk-actions` + all pre-existing admin specs.
5. Sprint 02's admin axe checks still green on the migrated pages (`aria-sort`, labeled checkboxes, `aria-live` bar verified).

## Tests

- New: admin-svc paging route tests; `tables-ergonomics.spec.ts`; `bulk-actions.spec.ts`; admin-ui bulk-layer unit tests.
- Update: any spec referencing the deleted bespoke tables.
- Full admin unit + compose lanes green.

## Out of scope

- Command palette, saved views/column management, virtualization (below Major; deferred). Date-range pickers beyond what audit export already has. Bulk operations beyond the two invite flows. admin-svc endpoints not in the four-list set. Web-v2/mobile.

## Depends on

**Sprint 10** (`ConfirmDangerDialog`, `FlashRegion`).

## Checkpoint

Summarize: per-page column diff (before/after), the admin-svc API additions (params + defaults), bulk audit evidence (the two entries), DoD outputs. **Pause for owner review. Do not commit, stage, or push unless explicitly instructed.**
