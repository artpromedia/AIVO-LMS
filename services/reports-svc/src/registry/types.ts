/**
 * Declarative report-definition contract (Sprint 10).
 *
 * Each `*.report.ts` file exports a `ReportDefinition`. The definition is the
 * single source of truth for the catalog, the auto-generated param form, the
 * column schema, the resolver that produces rows, caching, and ownership /
 * review metadata. Keeping reports declarative means the framework (runners,
 * scope filtering, lineage, scheduling, export) is fully reusable and a new
 * report is just one file (see docs/dev/adding-a-report.md).
 */

export type ReportScope = "platform" | "district" | "school";
export type ReportFormat = "csv" | "json" | "parquet" | "pdf";

export type ParamType = "string" | "number" | "boolean" | "date" | "enum" | "tenantId";

export interface ReportParam {
  name: string;
  label: string;
  type: ParamType;
  required?: boolean;
  /** For `enum` params. */
  options?: string[];
  default?: string | number | boolean;
  description?: string;
}

export interface ReportColumn {
  key: string;
  label: string;
  type: "string" | "number" | "date" | "currency" | "percent";
}

/** A data source consulted by a report — captured into run lineage. */
export interface ReportSource {
  service: string;
  /** Logical query/view name + a version so lineage is reproducible. */
  query: string;
  queryVersion: string;
}

export interface ReportResolverContext {
  params: Record<string, unknown>;
  /** Tenants the caller may access (scope-limited). */
  allowedTenantIds: string[];
  callerScope: ReportScope;
}

export interface ReportResolverResult {
  rows: Array<Record<string, unknown>>;
  sources: ReportSource[];
}

export interface ReportDefinition {
  id: string;
  title: string;
  description: string;
  category: string;
  scopes: ReportScope[];
  params: ReportParam[];
  columns: ReportColumn[];
  defaultFormat: ReportFormat;
  /** Result cache TTL in seconds for identical (reportId+params+tenant). */
  cacheTtl: number;
  /** Governance: owner + last-reviewed date (DoD requirement). */
  owner: string;
  lastReviewed: string;
  /**
   * Produce the report rows. Pure-ish: reads from seeded/service data, never
   * mutates. Resolvers must honour `ctx.allowedTenantIds` for tenant scoping.
   */
  resolve: (ctx: ReportResolverContext) => Promise<ReportResolverResult> | ReportResolverResult;
}
