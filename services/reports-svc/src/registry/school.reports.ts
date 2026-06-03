/**
 * School-scope reports (Sprint 10): enrollment, learning-time,
 * intervention-summary, attendance-proxy. All honour `ctx.allowedTenantIds`.
 */
import type { ReportDefinition, ReportResolverContext } from "./types.js";
import { SEED_TENANTS } from "./seed-data.js";

const OWNER = "School Insights — school-insights@aivo.example";
const REVIEWED = "2026-06-01";

function scopedTenants(ctx: ReportResolverContext) {
  return SEED_TENANTS.filter((t) => ctx.allowedTenantIds.includes(t.tenantId));
}

export const schoolEnrollment: ReportDefinition = {
  id: "enrollment",
  title: "Enrollment",
  description: "Active learner enrollment for the school.",
  category: "Enrollment",
  scopes: ["school"],
  params: [{ name: "tenantId", label: "Tenant", type: "tenantId", required: true }],
  columns: [
    { key: "name", label: "School", type: "string" },
    { key: "enrollment", label: "Enrollment", type: "number" },
  ],
  defaultFormat: "csv",
  cacheTtl: 300,
  owner: OWNER,
  lastReviewed: REVIEWED,
  resolve: (ctx) => ({
    rows: scopedTenants(ctx).map((t) => ({ name: t.name, enrollment: t.enrollment })),
    sources: [{ service: "identity-svc", query: "school_enrollment", queryVersion: "v1" }],
  }),
};

export const learningTime: ReportDefinition = {
  id: "learning-time",
  title: "Learning Time",
  description: "Total learning minutes and per-learner average.",
  category: "Engagement",
  scopes: ["school"],
  params: [{ name: "tenantId", label: "Tenant", type: "tenantId", required: true }],
  columns: [
    { key: "name", label: "School", type: "string" },
    { key: "learningMinutes", label: "Total minutes", type: "number" },
    { key: "avgPerLearner", label: "Avg / learner", type: "number" },
  ],
  defaultFormat: "csv",
  cacheTtl: 120,
  owner: OWNER,
  lastReviewed: REVIEWED,
  resolve: (ctx) => ({
    rows: scopedTenants(ctx).map((t) => ({
      name: t.name,
      learningMinutes: t.learningMinutes,
      avgPerLearner: t.enrollment ? Math.round(t.learningMinutes / t.enrollment) : 0,
    })),
    sources: [{ service: "learning-svc", query: "learning_time", queryVersion: "v2" }],
  }),
};

export const interventionSummary: ReportDefinition = {
  id: "intervention-summary",
  title: "Intervention Summary",
  description: "Count of interventions triggered for the school.",
  category: "Support",
  scopes: ["school"],
  params: [{ name: "tenantId", label: "Tenant", type: "tenantId", required: true }],
  columns: [
    { key: "name", label: "School", type: "string" },
    { key: "interventions", label: "Interventions", type: "number" },
  ],
  defaultFormat: "csv",
  cacheTtl: 300,
  owner: OWNER,
  lastReviewed: REVIEWED,
  resolve: (ctx) => ({
    rows: scopedTenants(ctx).map((t) => ({ name: t.name, interventions: t.interventions })),
    sources: [{ service: "recommendation-svc", query: "intervention_summary", queryVersion: "v1" }],
  }),
};

export const attendanceProxy: ReportDefinition = {
  id: "attendance-proxy",
  title: "Attendance Proxy",
  description: "Engagement-derived attendance proxy percentage.",
  category: "Engagement",
  scopes: ["school"],
  params: [{ name: "tenantId", label: "Tenant", type: "tenantId", required: true }],
  columns: [
    { key: "name", label: "School", type: "string" },
    { key: "attendanceProxyPct", label: "Attendance proxy", type: "percent" },
  ],
  defaultFormat: "csv",
  cacheTtl: 300,
  owner: OWNER,
  lastReviewed: REVIEWED,
  resolve: (ctx) => ({
    rows: scopedTenants(ctx).map((t) => ({
      name: t.name,
      attendanceProxyPct: t.attendanceProxyPct,
    })),
    sources: [{ service: "engagement-svc", query: "attendance_proxy", queryVersion: "v1" }],
  }),
};

export const schoolReports: ReportDefinition[] = [
  schoolEnrollment,
  learningTime,
  interventionSummary,
  attendanceProxy,
];
