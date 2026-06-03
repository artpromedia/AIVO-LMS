/**
 * District-scope reports (Sprint 10): enrollment-by-school, seat-utilization,
 * sis-sync-health, dsar-status. All honour `ctx.allowedTenantIds`.
 */
import type { ReportDefinition, ReportResolverContext } from "./types.js";
import { SEED_TENANTS } from "./seed-data.js";

const OWNER = "District Analytics — district-analytics@aivo.example";
const REVIEWED = "2026-06-01";

function scopedTenants(ctx: ReportResolverContext) {
  return SEED_TENANTS.filter((t) => ctx.allowedTenantIds.includes(t.tenantId));
}

export const enrollmentBySchool: ReportDefinition = {
  id: "enrollment-by-school",
  title: "Enrollment by School",
  description: "Active enrollment per school in the district.",
  category: "Enrollment",
  scopes: ["district"],
  params: [{ name: "tenantId", label: "Tenant", type: "tenantId", required: true }],
  columns: [
    { key: "schoolId", label: "School", type: "string" },
    { key: "name", label: "Name", type: "string" },
    { key: "enrollment", label: "Enrollment", type: "number" },
  ],
  defaultFormat: "csv",
  cacheTtl: 300,
  owner: OWNER,
  lastReviewed: REVIEWED,
  resolve: (ctx) => ({
    rows: scopedTenants(ctx).map((t) => ({
      schoolId: t.schoolId,
      name: t.name,
      enrollment: t.enrollment,
    })),
    sources: [{ service: "identity-svc", query: "enrollment_by_school", queryVersion: "v1" }],
  }),
};

export const seatUtilization: ReportDefinition = {
  id: "seat-utilization",
  title: "Seat Utilization",
  description: "Licensed vs active seats and utilization rate.",
  category: "Licensing",
  scopes: ["district"],
  params: [{ name: "tenantId", label: "Tenant", type: "tenantId", required: true }],
  columns: [
    { key: "name", label: "School", type: "string" },
    { key: "seatsLicensed", label: "Licensed", type: "number" },
    { key: "seatsActive", label: "Active", type: "number" },
    { key: "utilization", label: "Utilization", type: "percent" },
  ],
  defaultFormat: "csv",
  cacheTtl: 300,
  owner: OWNER,
  lastReviewed: REVIEWED,
  resolve: (ctx) => ({
    rows: scopedTenants(ctx).map((t) => ({
      name: t.name,
      seatsLicensed: t.seatsLicensed,
      seatsActive: t.seatsActive,
      utilization: t.seatsLicensed ? Number((t.seatsActive / t.seatsLicensed).toFixed(4)) : 0,
    })),
    sources: [{ service: "billing-svc", query: "seat_utilization", queryVersion: "v1" }],
  }),
};

export const sisSyncHealth: ReportDefinition = {
  id: "sis-sync-health",
  title: "SIS Sync Health",
  description: "Last sync time and status per school.",
  category: "Integrations",
  scopes: ["district"],
  params: [{ name: "tenantId", label: "Tenant", type: "tenantId", required: true }],
  columns: [
    { key: "name", label: "School", type: "string" },
    { key: "sisStatus", label: "Status", type: "string" },
    { key: "sisLastSyncAt", label: "Last sync", type: "date" },
  ],
  defaultFormat: "csv",
  cacheTtl: 60,
  owner: OWNER,
  lastReviewed: REVIEWED,
  resolve: (ctx) => ({
    rows: scopedTenants(ctx).map((t) => ({
      name: t.name,
      sisStatus: t.sisStatus,
      sisLastSyncAt: t.sisLastSyncAt,
    })),
    sources: [{ service: "integration-svc", query: "sis_sync_health", queryVersion: "v3" }],
  }),
};

export const dsarStatus: ReportDefinition = {
  id: "dsar-status",
  title: "DSAR Status",
  description: "Open and closed data-subject access requests per school.",
  category: "Compliance",
  scopes: ["district"],
  params: [{ name: "tenantId", label: "Tenant", type: "tenantId", required: true }],
  columns: [
    { key: "name", label: "School", type: "string" },
    { key: "dsarOpen", label: "Open", type: "number" },
    { key: "dsarClosed", label: "Closed", type: "number" },
  ],
  defaultFormat: "csv",
  cacheTtl: 300,
  owner: OWNER,
  lastReviewed: REVIEWED,
  resolve: (ctx) => ({
    rows: scopedTenants(ctx).map((t) => ({
      name: t.name,
      dsarOpen: t.dsarOpen,
      dsarClosed: t.dsarClosed,
    })),
    sources: [{ service: "data-governance-svc", query: "dsar_status", queryVersion: "v2" }],
  }),
};

export const districtReports: ReportDefinition[] = [
  enrollmentBySchool,
  seatUtilization,
  sisSyncHealth,
  dsarStatus,
];
