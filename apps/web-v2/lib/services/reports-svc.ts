/**
 * reports-svc client (Sprint 10). Reads fall back to inline samples so the
 * reports console renders in the local/demo workflow with no service running.
 * Writes (run/schedule) propagate failures to the caller.
 */
import { serverEnv } from "@/lib/env";
import { callService } from "./client";

const SERVICE = "reports-svc";
const base = () => serverEnv.REPORTS_SVC_URL;

export interface ReportCatalogItem {
  id: string;
  title: string;
  description: string;
  category: string;
  scopes: string[];
  defaultFormat: string;
  owner: string;
  lastReviewed: string;
}

export interface ReportSchema {
  id: string;
  title: string;
  description: string;
  params: Array<{
    name: string;
    label: string;
    type: string;
    required?: boolean;
    options?: string[];
    default?: unknown;
  }>;
  columns: Array<{ key: string; label: string; type: string }>;
  defaultFormat: string;
  formats: string[];
  allowedTenantIds: string[];
}

const SAMPLE_CATALOG: ReportCatalogItem[] = [
  {
    id: "enrollment-by-school",
    title: "Enrollment by School",
    description: "Active enrollment per school in the district.",
    category: "Enrollment",
    scopes: ["district"],
    defaultFormat: "csv",
    owner: "District Analytics",
    lastReviewed: "2026-06-01",
  },
  {
    id: "seat-utilization",
    title: "Seat Utilization",
    description: "Licensed vs active seats and utilization rate.",
    category: "Licensing",
    scopes: ["district"],
    defaultFormat: "csv",
    owner: "District Analytics",
    lastReviewed: "2026-06-01",
  },
];

function authHeaders(scope: { role: string; tenantId?: string; actorId?: string }) {
  return {
    "x-actor-role": scope.role,
    ...(scope.tenantId ? { "x-tenant-id": scope.tenantId } : {}),
    ...(scope.actorId ? { "x-actor-id": scope.actorId } : {}),
  };
}

export async function listReports(
  scope: { role: string; tenantId?: string; actorId?: string },
  opts: { requestId?: string } = {},
): Promise<{ reports: ReportCatalogItem[]; quota?: { used: number; limit: number } }> {
  const res = await callService<{ reports: ReportCatalogItem[]; quota: any }>({
    service: SERVICE,
    baseUrl: base(),
    url: "/api/reports",
    headers: authHeaders(scope),
    requestId: opts.requestId,
  });
  return res.ok ? res.data : { reports: SAMPLE_CATALOG };
}

export async function getReportSchema(
  id: string,
  scope: { role: string; tenantId?: string; actorId?: string },
  opts: { requestId?: string } = {},
): Promise<ReportSchema | null> {
  const res = await callService<ReportSchema>({
    service: SERVICE,
    baseUrl: base(),
    url: `/api/reports/${encodeURIComponent(id)}/schema`,
    headers: authHeaders(scope),
    requestId: opts.requestId,
  });
  return res.ok ? res.data : null;
}

export async function listSchedules(
  scope: { role: string; tenantId?: string; actorId?: string },
  opts: { requestId?: string } = {},
): Promise<any[]> {
  const res = await callService<{ schedules: any[] }>({
    service: SERVICE,
    baseUrl: base(),
    url: "/api/reports/schedules",
    headers: authHeaders(scope),
    requestId: opts.requestId,
  });
  return res.ok ? res.data.schedules : [];
}

export async function getRun(
  runId: string,
  scope: { role: string; tenantId?: string; actorId?: string },
  opts: { requestId?: string } = {},
): Promise<any | null> {
  const res = await callService<any>({
    service: SERVICE,
    baseUrl: base(),
    url: `/api/reports/runs/${encodeURIComponent(runId)}`,
    headers: authHeaders(scope),
    requestId: opts.requestId,
  });
  return res.ok ? res.data : null;
}
