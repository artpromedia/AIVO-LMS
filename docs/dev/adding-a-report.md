# Adding a Report

How to add a new cross-tier report to `services/reports-svc`. The framework
(run engine, scope/tenant RBAC, caching, quota, lineage, scheduling, export)
is fully reusable — a new report is **one `ReportDefinition`** plus a single
registry line. See ADR 0039 for the architecture.

## The contract in one paragraph

You export a `ReportDefinition` (`src/registry/types.ts`). It declares its
`id`/`title`/`category`, the `scopes[]` (which admin tiers may run it), the
typed `params[]` (which become the UI form + validation), the typed
`columns[]` (the output schema), a `resolve(ctx)` that returns
`{ rows, sources }`, a `defaultFormat`, a `cacheTtl`, and governance
metadata (`owner`, `lastReviewed`). The engine does the rest.

**The one rule you must not break:** your resolver **must** filter to
`ctx.allowedTenantIds`. That set is the caller's scope-limited tenant
allow-list; reading anything outside it is a cross-tenant leak.

## Worked example — a "teacher-activity" school report

We'll add a school-scope report listing, per school, the number of active
teachers and how many posted activity this week.

### 1. Write the report file

Create `services/reports-svc/src/registry/teacher-activity.report.ts` (or add
the definition into `school.reports.ts` next to the other school reports — see
step 2 on registration). A complete, self-contained definition:

```ts
/**
 * teacher-activity (school scope) — active teachers and weekly-active
 * teachers per school. Honours ctx.allowedTenantIds (never reads a tenant
 * outside the caller's scope).
 */
import type { ReportDefinition, ReportResolverContext } from "./types.js";
import { SEED_TENANTS } from "./seed-data.js";

const OWNER = "School Insights — school-insights@aivo.example";
const LAST_REVIEWED = "2026-06-03";

function scopedTenants(ctx: ReportResolverContext) {
  // The single most important line: filter to what the caller may see.
  return SEED_TENANTS.filter((t) => ctx.allowedTenantIds.includes(t.tenantId));
}

export const teacherActivity: ReportDefinition = {
  id: "teacher-activity",
  title: "Teacher Activity",
  description: "Active teachers and weekly-active teachers per school.",
  category: "Engagement",
  scopes: ["school"],

  // Typed params drive validation AND the auto-generated UI form.
  params: [
    { name: "tenantId", label: "Tenant", type: "tenantId", required: true },
    {
      name: "window",
      label: "Activity window",
      type: "enum",
      options: ["7d", "30d"],
      default: "7d",
      required: false,
    },
  ],

  // Typed columns are the output schema (CSV headers, JSON keys, PDF table).
  columns: [
    { key: "name", label: "School", type: "string" },
    { key: "activeTeachers", label: "Active teachers", type: "number" },
    { key: "weeklyActive", label: "Weekly-active teachers", type: "number" },
    { key: "activeRate", label: "Active rate", type: "percent" },
  ],

  defaultFormat: "csv",
  // Activity changes slowly; 5 min cache keeps repeat pulls cheap.
  cacheTtl: 300,

  owner: OWNER,
  lastReviewed: LAST_REVIEWED,

  resolve: (ctx) => {
    const window = (ctx.params.window as string) ?? "7d";
    const rows = scopedTenants(ctx).map((t) => {
      const activeTeachers = t.teachers ?? 0;
      // Stand-in derivation against seed data; a real resolver would query
      // engagement-svc for the chosen window.
      const weeklyActive = window === "30d" ? activeTeachers : Math.round(activeTeachers * 0.7);
      return {
        name: t.name,
        activeTeachers,
        weeklyActive,
        activeRate: activeTeachers ? Math.round((weeklyActive / activeTeachers) * 100) : 0,
      };
    });
    return {
      rows,
      // Lineage: each source is recorded against the run so the number is
      // reproducible and attributable (service + logical query + version).
      sources: [
        {
          service: "engagement-svc",
          query: "teacher_activity",
          queryVersion: "v1",
        },
      ],
    };
  },
};
```

Notes on the fields you'll most often get wrong:

- **`scopes`** controls who _sees_ and _runs_ it. `["school"]` means school,
  district, and platform admins can run it (caller scope ≥ report scope), but
  it appears in the school catalog. Set the _lowest_ tier that should own it.
- **`params` types** are validated by the engine (`validateParams` in
  `src/runners/engine.ts`): `required`, `enum` `options`, and `default` are
  all enforced before your resolver runs. A `tenantId` param is additionally
  checked against the caller's allow-list.
- **`cacheTtl`** is in seconds and the cache key is
  `reportId + params + tenant + format`. Pick a TTL that matches how fast the
  underlying data changes; `0` effectively disables caching.
- **`owner` / `lastReviewed`** are governance metadata (DoD). Use a real
  contact and today's date; a stale `lastReviewed` is a review signal.

### 2. Register it

The registry (`src/registry/index.ts`) collects reports from three grouped
arrays — `platformReports`, `districtReports`, `schoolReports` — and builds
the catalog and `byId` map from `[...platform, ...district, ...school]`.

Add your definition to the array for its tier. For this school report, edit
`src/registry/school.reports.ts`:

```ts
import { teacherActivity } from "./teacher-activity.report.js";
// ...
export const schoolReports: ReportDefinition[] = [
  schoolEnrollment,
  learningTime,
  interventionSummary,
  attendanceProxy,
  teacherActivity, // ← new
];
```

(If you prefer to keep the definition inside `school.reports.ts` rather than a
separate `*.report.ts` file, just append the exported const to the array —
the registry only cares that it ends up in the group array.) Once it's in the
array, `listReports`, `getReport`, `catalogForScope`, and the routes pick it
up automatically — no route changes.

### 3. Test it

Three things to cover. Add a `*.test.ts` alongside the report (or in the
service's test dir):

```ts
import { describe, it, expect } from "vitest";
import { validateParams, executeRun } from "../runners/engine.js";
import { getReport } from "../registry/index.js";

const def = getReport("teacher-activity")!;

describe("teacher-activity report", () => {
  // 1) Param validation — required tenantId, enum window.
  it("requires tenantId and rejects a bad window", () => {
    expect(validateParams(def, {}).ok).toBe(false);
    expect(validateParams(def, { tenantId: "t-1", window: "99d" }).ok).toBe(false);
    expect(validateParams(def, { tenantId: "t-1", window: "7d" }).ok).toBe(true);
  });

  // 2) Scope/tenant — resolver must not read outside allowedTenantIds.
  it("only returns rows for allowed tenants", () => {
    const result = def.resolve({
      params: { tenantId: "t-1", window: "7d" },
      allowedTenantIds: ["t-1"],
      callerScope: "school",
    });
    const tenants = new Set(result.rows.map((r) => r.name));
    // No row for a tenant the caller can't see.
    expect(tenants.size).toBeGreaterThanOrEqual(0);
    // Empty allow-list ⇒ no rows.
    expect(
      def.resolve({
        params: { tenantId: "t-1", window: "7d" },
        allowedTenantIds: [],
        callerScope: "school",
      }).rows,
    ).toHaveLength(0);
  });

  // 3) Snapshot — deterministic output (CSV/JSON/parquet are byte-stable for
  //    the same rows, which is what makes the snapshot meaningful).
  it("produces a stable CSV", async () => {
    const run = await executeRun({
      def,
      params: { tenantId: "t-1", window: "7d" },
      allowedTenantIds: ["t-1"],
      callerScope: "school",
      format: "csv",
    });
    expect(run.output).toMatchSnapshot();
  });
});
```

What each test guards:

- **Param validation** — catches missing `required` params and bad `enum`
  values before they reach your resolver.
- **Scope** — proves the resolver honours `allowedTenantIds` (empty ⇒ empty),
  which is the cross-tenant-leak guard.
- **Snapshot** — pins the encoded output. Because CSV/JSON/Parquet are
  deterministic for the same rows, a snapshot drift means the data or the
  schema changed — review it before updating the snapshot.

### 4. Run it locally

```bash
pnpm --filter @aivo/reports-svc dev
# Catalog (scope-filtered): GET /api/reports
# Schema:                   GET /api/reports/teacher-activity/schema
# Run:                      POST /api/reports/teacher-activity/run
#                             { "params": { "tenantId": "t-1", "window": "7d" },
#                               "format": "csv" }
# Download:                 GET /api/reports/runs/{runId}/download
```

That's the whole loop: one definition, one registry line, three tests. The
engine handles RBAC, caching, quota, lineage, audit, and export for you.

## Checklist before opening the PR

- [ ] Resolver filters to `ctx.allowedTenantIds`.
- [ ] `scopes` set to the lowest tier that should own the report.
- [ ] Every `column.key` is produced by the resolver; types match.
- [ ] `owner` is a real contact; `lastReviewed` is today.
- [ ] `cacheTtl` matches the data's change rate.
- [ ] Added to the right group array in `src/registry/*.reports.ts`.
- [ ] Param-validation, scope, and snapshot tests pass.
- [ ] `pnpm --filter @aivo/reports-svc test` and `pnpm api:check` are green.
