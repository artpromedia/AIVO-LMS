/**
 * Platform-scope reports (Sprint 10): tenant-growth, MRR-by-plan,
 * DAU/WAU/MAU, incident-frequency.
 */
import type { ReportDefinition } from "./types.js";
import { SEED_TENANTS, SEED_INCIDENTS } from "./seed-data.js";

const OWNER = "Data Platform — data-eng@aivo.example";
const REVIEWED = "2026-06-01";

export const tenantGrowth: ReportDefinition = {
  id: "tenant-growth",
  title: "Tenant Growth",
  description: "New tenants and cumulative count over time.",
  category: "Growth",
  scopes: ["platform"],
  params: [
    { name: "sinceDays", label: "Window (days)", type: "number", default: 365 },
  ],
  columns: [
    { key: "tenantId", label: "Tenant", type: "string" },
    { key: "name", label: "Name", type: "string" },
    { key: "plan", label: "Plan", type: "string" },
    { key: "createdAt", label: "Created", type: "date" },
  ],
  defaultFormat: "csv",
  cacheTtl: 300,
  owner: OWNER,
  lastReviewed: REVIEWED,
  resolve: (ctx) => {
    const since = Number(ctx.params.sinceDays ?? 365);
    const cutoff = Date.now() - since * 86_400_000;
    const rows = SEED_TENANTS.filter((t) => new Date(t.createdAt).getTime() >= cutoff)
      .map((t) => ({ tenantId: t.tenantId, name: t.name, plan: t.plan, createdAt: t.createdAt }))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return {
      rows,
      sources: [{ service: "tenant-svc", query: "tenants_by_created", queryVersion: "v1" }],
    };
  },
};

export const mrrByPlan: ReportDefinition = {
  id: "mrr-by-plan",
  title: "MRR by Plan",
  description: "Monthly recurring revenue grouped by subscription plan.",
  category: "Revenue",
  scopes: ["platform"],
  params: [],
  columns: [
    { key: "plan", label: "Plan", type: "string" },
    { key: "tenants", label: "Tenants", type: "number" },
    { key: "mrrUsd", label: "MRR", type: "currency" },
  ],
  defaultFormat: "csv",
  cacheTtl: 300,
  owner: OWNER,
  lastReviewed: REVIEWED,
  resolve: () => {
    const byPlan = new Map<string, { tenants: number; mrrUsd: number }>();
    for (const t of SEED_TENANTS) {
      const e = byPlan.get(t.plan) ?? { tenants: 0, mrrUsd: 0 };
      e.tenants += 1;
      e.mrrUsd += t.mrrUsd;
      byPlan.set(t.plan, e);
    }
    const rows = [...byPlan.entries()]
      .map(([plan, v]) => ({ plan, tenants: v.tenants, mrrUsd: v.mrrUsd }))
      .sort((a, b) => b.mrrUsd - a.mrrUsd);
    return {
      rows,
      sources: [{ service: "billing-svc", query: "mrr_by_plan", queryVersion: "v2" }],
    };
  },
};

export const activeUsers: ReportDefinition = {
  id: "dau-wau-mau",
  title: "DAU / WAU / MAU",
  description: "Daily, weekly, and monthly active users per tenant.",
  category: "Engagement",
  scopes: ["platform"],
  params: [],
  columns: [
    { key: "tenantId", label: "Tenant", type: "string" },
    { key: "dau", label: "DAU", type: "number" },
    { key: "wau", label: "WAU", type: "number" },
    { key: "mau", label: "MAU", type: "number" },
    { key: "stickiness", label: "DAU/MAU", type: "percent" },
  ],
  defaultFormat: "csv",
  cacheTtl: 120,
  owner: OWNER,
  lastReviewed: REVIEWED,
  resolve: () => ({
    rows: SEED_TENANTS.map((t) => ({
      tenantId: t.tenantId,
      dau: t.dau,
      wau: t.wau,
      mau: t.mau,
      stickiness: t.mau ? Number((t.dau / t.mau).toFixed(4)) : 0,
    })),
    sources: [{ service: "engagement-svc", query: "active_users", queryVersion: "v1" }],
  }),
};

export const incidentFrequency: ReportDefinition = {
  id: "incident-frequency",
  title: "Incident Frequency",
  description: "Incident counts by month with severity breakdown.",
  category: "Reliability",
  scopes: ["platform"],
  params: [],
  columns: [
    { key: "month", label: "Month", type: "string" },
    { key: "count", label: "Incidents", type: "number" },
    { key: "sev1", label: "Sev1", type: "number" },
    { key: "sev2", label: "Sev2", type: "number" },
  ],
  defaultFormat: "csv",
  cacheTtl: 600,
  owner: OWNER,
  lastReviewed: REVIEWED,
  resolve: () => ({
    rows: SEED_INCIDENTS.map((i) => ({ ...i })),
    sources: [{ service: "status-page-svc", query: "incident_frequency", queryVersion: "v1" }],
  }),
};

export const platformReports: ReportDefinition[] = [
  tenantGrowth,
  mrrByPlan,
  activeUsers,
  incidentFrequency,
];
