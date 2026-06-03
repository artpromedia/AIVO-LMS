/**
 * Report registry (Sprint 10) — collects every declarative report definition.
 * In production the loader would glob `*.report.ts`; here we import the
 * grouped definition modules explicitly so the registry is tree-shakeable and
 * type-checked.
 */
import type { ReportDefinition, ReportScope } from "./types.js";
import { platformReports } from "./platform.reports.js";
import { districtReports } from "./district.reports.js";
import { schoolReports } from "./school.reports.js";

export * from "./types.js";

const ALL: ReportDefinition[] = [...platformReports, ...districtReports, ...schoolReports];

const byId = new Map<string, ReportDefinition>(ALL.map((r) => [r.id, r]));

export function listReports(): ReportDefinition[] {
  return [...ALL];
}

export function getReport(id: string): ReportDefinition | undefined {
  return byId.get(id);
}

/** Scope ordering: a caller may run any report whose scope ≤ their role's scope. */
const SCOPE_RANK: Record<ReportScope, number> = { school: 0, district: 1, platform: 2 };

/** True when a caller at `callerScope` may access a report at `reportScope`. */
export function scopeAllows(callerScope: ReportScope, reportScopes: ReportScope[]): boolean {
  return reportScopes.some((s) => SCOPE_RANK[s] <= SCOPE_RANK[callerScope]);
}

/** Catalog filtered to what the caller scope may run. */
export function catalogForScope(callerScope: ReportScope): ReportDefinition[] {
  return ALL.filter((r) => scopeAllows(callerScope, r.scopes));
}
