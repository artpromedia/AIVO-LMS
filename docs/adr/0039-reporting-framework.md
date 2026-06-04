# 0039 — Cross-Tier Reporting Framework: declarative reports, scoped runs, lineage, and multi-format export

- **Status:** Accepted
- **Date:** 2026-06-03
- **Related:** Sprint 10 — Cross-Tier Reports & Exports; `services/reports-svc`
  (`src/registry/*`, `src/runners/{engine,formats,pdf,queue}.ts`,
  `src/{scope,lineage,store,audit}.ts`, `src/routes/reports.ts`),
  migration `src/db/migrations/0001_reports.sql`; ADR 0032 (audit), ADR 0036
  (responsible AI), ADR 0037 (observability & status).

## Context

District and school administrators repeatedly ask for the same thing in
different shapes: "show me my enrollment", "is my SIS sync healthy", "what's
our seat utilization", "give me MRR by plan" — at **three different admin
tiers** (platform, district, school), with **correct multi-tenant scoping**,
**reproducible** numbers an auditor or a board can trust, and **exports**
(CSV/PDF) they can hand to finance or compliance.

Before this sprint there was **no `/reports` surface** at all. The risk of
solving it ad-hoc is well understood: a sprawl of per-tier, per-question
endpoints that each re-implement RBAC, tenant filtering, formatting, and
caching slightly differently, drift out of sync, leak cross-tenant data, and
produce numbers nobody can reproduce or attribute to a source.

We want a **single framework** where adding a report is one declarative file,
the engine handles scope/tenant RBAC, caching, quota, lineage, and export
uniformly, and every run is audited. This ADR records that design
(`services/reports-svc`).

## Decision

### 1. The declarative `ReportDefinition` contract

Every report is one exported `ReportDefinition` (`src/registry/types.ts`).
The definition is the single source of truth for the catalog, the
auto-generated param form, the column schema, the resolver, caching, and
governance metadata:

| Field                                    | Purpose                                                                                               |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `id`, `title`, `description`, `category` | Catalog identity & grouping.                                                                          |
| `scopes[]`                               | Which admin tiers the report belongs to (`platform`/`district`/`school`).                             |
| `params[]`                               | Typed inputs (`string`/`number`/`boolean`/`date`/`enum`/`tenantId`) → drive validation + the UI form. |
| `columns[]`                              | Typed output schema (`string`/`number`/`date`/`currency`/`percent`) → encoders + headers.             |
| `resolve(ctx)`                           | Pure-ish resolver returning `{ rows, sources }`; **must honour `ctx.allowedTenantIds`**.              |
| `defaultFormat`                          | `csv`/`json`/`parquet`/`pdf`.                                                                         |
| `cacheTtl`                               | Result-cache TTL (seconds) keyed on `reportId+params+tenant+format`.                                  |
| `owner`, `lastReviewed`                  | Governance — a named owner and a last-reviewed date (DoD requirement).                                |

**12 initial reports** ship across the three tiers:

| Scope    | Reports                                                                      |
| -------- | ---------------------------------------------------------------------------- |
| Platform | `tenant-growth`, `mrr-by-plan`, `dau-wau-mau`, `incident-frequency`          |
| District | `enrollment-by-school`, `seat-utilization`, `sis-sync-health`, `dsar-status` |
| School   | `enrollment`, `learning-time`, `intervention-summary`, `attendance-proxy`    |

### 2. Scope model — caller scope ≥ report scope, tenant-param allow-list

Scope is ordered `school < district < platform` (`src/registry/index.ts`,
`SCOPE_RANK`). A caller may run a report only when **the caller's scope ≥ the
report's scope** (`scopeAllows`), and the **catalog is filtered** to exactly
that set (`catalogForScope`) — a school admin never even _sees_ a
district-scope report.

Tenant scoping is independent of the catalog: `resolveCallerScope`
(`src/scope.ts`) derives the caller's `allowedTenantIds` (platform → all,
district → tenants in the district, school → own tenant only). Any
`tenantId` param must be **in the caller's allow-list**; resolvers receive
`ctx.allowedTenantIds` and filter to it, so a forged or out-of-scope tenant
param cannot widen the result.

| Failure                                                | Code                   |
| ------------------------------------------------------ | ---------------------- |
| Caller scope < report scope (or report not in catalog) | `403 SCOPE_FORBIDDEN`  |
| `tenantId` param outside the caller's allow-list       | `403 TENANT_FORBIDDEN` |
| Daily run quota exceeded                               | `429`                  |

### 3. Run engine — validate → RBAC → cache → resolve → lineage → encode

`executeRun` (`src/runners/engine.ts`) is the one path every run takes,
inline by default and identical to what a worker calls:

1. **Param validation** against `params[]` (types, required, enum options,
   defaults).
2. **Scope + tenant RBAC** (`scopeAllows`, allow-list check).
3. **Result-cache lookup**, keyed on `reportId + params + tenant + format`,
   honouring the report's `cacheTtl` (`cacheKeyOf`).
4. **Resolve** rows via the definition's resolver.
5. **Lineage capture** — for each `ReportSource` the resolver declares
   (`service`, `query`, `queryVersion`), recorded against the run
   (`src/lineage.ts`, `report_run_lineage`).
6. **Format encode** (below) and persist the run.

### 4. Format encoders

| Format    | Implementation                           | Notes                                                                                                                                         |
| --------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `csv`     | `encodeCsv` (`src/runners/formats.ts`)   | RFC-4180 quoting/escaping.                                                                                                                    |
| `json`    | `encodeJson`                             | Rows + column schema.                                                                                                                         |
| `parquet` | `encodeParquet`                          | **Deterministic Parquet container** stand-in (byte-stable for the same rows) until a full columnar writer lands.                              |
| `pdf`     | `renderReportPdf` (`src/runners/pdf.ts`) | **Branded** PDF via **Playwright** in a separate worker pod; **falls back to HTML** when no browser is available, with per-tenant `Branding`. |

### 5. Quota, scheduling, workers, governance

- **Per-tenant daily quota:** **1000 runs/day** → **`429`** on exceed
  (`report_quota_daily`); the UI surfaces usage.
- **Scheduling:** `POST|GET /api/reports/schedules`,
  `DELETE /api/reports/schedules/{id}`. Deliveries go **only to verified
  recipients within the caller's scope** (`report_schedules`).
- **Workers:** optional **BullMQ per-format workers**
  (`reports:csv|json|parquet|pdf`, `src/runners/queue.ts`) when `REDIS_URL`
  is set; **inline by default**. The PDF worker runs in its own pod (browser).
- **Governance:** every definition carries `owner` + `lastReviewed`; a stale
  report is a review signal, not a silent liability.

### 6. Routes & audit

`GET /api/reports` (scope-filtered catalog), `GET /api/reports/{id}/schema`,
`POST /api/reports/{id}/run`, `GET /api/reports/runs/{runId}`,
`GET /api/reports/runs/{runId}/download`, the schedule routes above.
**Audit** (`src/audit.ts`, via `@aivo/audit-client`, ADR 0032): **every run
(with its params)**, every **download**, and every **schedule
create/delete** — so who pulled what data, when, and over which tenants is
fully reconstructible.

## Alternatives considered

- **Looker / Metabase / Mode (SaaS BI).** Rejected: tenant-data egress and
  FERPA concerns, weak fit to our three-tier scope model and tenant
  allow-list semantics, per-seat cost, and no integration with our audit
  chain or quota. The declarative contract keeps a future BI export possible
  without re-architecting.
- **Ad-hoc per-tier endpoints (status quo of "just add a route").**
  Rejected: every report re-implements RBAC, tenant filtering, formatting,
  caching, and lineage, which drifts and leaks. The framework makes those
  cross-cutting concerns one shared, tested path.

## Consequences

**Positive**

- **One file per report**: extensibility is `*.report.ts` + a registry line;
  the engine, scope, lineage, quota, scheduling, and export are reused
  (`docs/dev/adding-a-report.md`).
- **Reproducibility via lineage**: a run records its sources
  (`service`/`query`/`queryVersion`), so a number can be traced to where it
  came from.
- **Backends protected**: the per-tenant daily quota caps blast radius; the
  result cache keeps repeat pulls cheap.

**Negative / tradeoffs**

- The run/schedule/quota **store is in-memory today** alongside the schema in
  **`src/db/migrations/0001_reports.sql`** (`report_runs`,
  `report_schedules`, `report_run_lineage`, `report_quota_daily`); durable
  persistence is a tracked follow-up.
- The **Parquet encoder is a deterministic stand-in**, not a full columnar
  writer; it is byte-stable (so snapshots hold) but is meant to be swapped
  for a real Parquet writer later.
- **PDF depends on a browser** (Playwright) in a worker pod; without it the
  engine returns branded **HTML** rather than failing — correct content,
  different container.

## References

- Migration: `services/reports-svc/src/db/migrations/0001_reports.sql`
  (`report_runs`, `report_schedules`, `report_run_lineage`,
  `report_quota_daily`)
- Run engine: `services/reports-svc/src/runners/engine.ts`
- Format encoders: `services/reports-svc/src/runners/formats.ts`,
  `src/runners/pdf.ts`
- Per-format workers: `services/reports-svc/src/runners/queue.ts`
- Scope / tenant RBAC: `services/reports-svc/src/scope.ts`,
  `src/registry/index.ts`
- Lineage: `services/reports-svc/src/lineage.ts`
- Definition contract & registry: `services/reports-svc/src/registry/`
- Routes: `services/reports-svc/src/routes/reports.ts`
- Developer guide: `docs/dev/adding-a-report.md`
- Troubleshooting: `docs/runbooks/reports-troubleshooting.md`
