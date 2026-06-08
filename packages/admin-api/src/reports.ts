import "server-only";

import { adminGet, adminPost } from "./client";
import type { SessionProfile } from "@aivo/admin-auth/types";

/** A single parameter accepted by a report definition. */
export interface AdminReportParam {
  name: string;
  type: "string" | "date" | "integer" | "boolean";
  required: boolean;
  description: string;
}

/** A report advertised by the admin-svc registry. */
export interface AdminReportDefinition {
  id: string;
  label: string;
  description?: string;
  /** True while rows are estimated rather than read from a source-of-record table. */
  estimated: boolean;
  params: AdminReportParam[];
}

/** The tabular result of running a report. */
export interface AdminReportResult {
  columns: string[];
  rows: Array<Record<string, unknown>>;
  reportId: string;
  schoolId: string;
  generatedAt: string;
  estimated: boolean;
  dataSource: string;
  total: number;
}

function s(value: unknown): string | null {
  return value == null ? null : String(value);
}

function mapParam(raw: Record<string, unknown>): AdminReportParam {
  const type = String(raw.type ?? "string");
  return {
    name: String(raw.name ?? ""),
    type:
      type === "date" || type === "integer" || type === "boolean"
        ? (type as AdminReportParam["type"])
        : "string",
    required: Boolean(raw.required),
    description: String(raw.description ?? ""),
  };
}

function mapDefinition(raw: Record<string, unknown>): AdminReportDefinition {
  const description = s(raw.description);
  return {
    id: String(raw.id),
    // admin-svc registry uses `name`; expose it as `label` for the UI idiom.
    label: String(raw.label ?? raw.name ?? raw.id),
    description: description ?? undefined,
    estimated: Boolean(raw.estimated),
    params: Array.isArray(raw.params)
      ? raw.params.map((p) => mapParam(p as Record<string, unknown>))
      : [],
  };
}

/** List the reports advertised by the admin-svc registry for a school. */
export async function listReportDefinitions(
  session: Pick<SessionProfile, "role">,
  schoolId: string,
): Promise<AdminReportDefinition[]> {
  const payload = await adminGet<Record<string, unknown>>(
    session,
    `/admin/schools/${encodeURIComponent(schoolId)}/reports`,
  );
  const reports = Array.isArray(payload.reports) ? payload.reports : [];
  return reports.map((r) => mapDefinition(r as Record<string, unknown>));
}

/** Run a report and return its `{ columns, rows }` result. */
export async function runReport(
  session: Pick<SessionProfile, "role">,
  schoolId: string,
  reportId: string,
  params: Record<string, unknown> = {},
): Promise<AdminReportResult> {
  const payload = await adminPost<Record<string, unknown>>(
    session,
    `/admin/schools/${encodeURIComponent(schoolId)}/reports/${encodeURIComponent(reportId)}/run`,
    params,
  );
  const columns = Array.isArray(payload.columns) ? payload.columns.map((c) => String(c)) : [];
  const rows = Array.isArray(payload.rows)
    ? (payload.rows as Array<Record<string, unknown>>)
    : [];
  return {
    columns,
    rows,
    reportId: String(payload.reportId ?? reportId),
    schoolId: String(payload.schoolId ?? schoolId),
    generatedAt: String(payload.generatedAt ?? new Date(0).toISOString()),
    estimated: Boolean(payload.estimated),
    dataSource: String(payload.dataSource ?? "source_of_record"),
    total: Number(payload.total ?? rows.length),
  };
}
