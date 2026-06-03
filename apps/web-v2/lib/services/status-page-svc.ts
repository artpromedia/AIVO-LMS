/**
 * status-page-svc + alerts-proxy-svc clients (Sprint 8).
 *
 * Reads fall back to inline samples so the public status page, the admin
 * status console, and the district/school health cards render in the
 * local/demo workflow with no services running. Writes propagate failures.
 */
import { serverEnv } from "@/lib/env";
import { callService } from "./client";

const STATUS = "status-page-svc";
const ALERTS = "alerts-proxy-svc";
const statusBase = () => serverEnv.STATUS_PAGE_SVC_URL;
const alertsBase = () => serverEnv.ALERTS_PROXY_SVC_URL;

export interface StatusComponent {
  id: string;
  name: string;
  group: string;
  status: string;
}

export interface StatusIncident {
  id: string;
  title: string;
  lifecycle?: string;
  impact?: string;
  affectedComponentIds?: string[];
  updatedAt?: string;
  resolvedAt?: string | null;
  postmortemUrl?: string;
}

export interface IncidentUpdate {
  lifecycle: string;
  body: string;
  author: string;
  createdAt: string;
}

export interface StatusMaintenance {
  id: string;
  title: string;
  state: string;
  scheduledStart: string;
  scheduledEnd: string;
}

export interface HealthSignal {
  service?: string;
  observedSli?: number;
  target?: number;
  status?: string;
}

export interface PublicSummary {
  overall: string;
  components: StatusComponent[];
  activeIncidents: Array<{
    id: string;
    title: string;
    lifecycle: string;
    impact: string;
    affectedComponentIds: string[];
    updatedAt: string;
  }>;
  recentIncidents: Array<{ id: string; title: string; resolvedAt: string | null; impact: string }>;
  upcomingMaintenances: Array<{
    id: string;
    title: string;
    state: string;
    scheduledStart: string;
    scheduledEnd: string;
  }>;
  generatedAt: string;
}

const SAMPLE_SUMMARY: PublicSummary = {
  overall: "operational",
  components: [
    { id: "comp-api", name: "API Gateway", group: "Core", status: "operational" },
    { id: "comp-identity", name: "Identity & SSO", group: "Core", status: "operational" },
    { id: "comp-tutor", name: "AI Tutor", group: "Learning", status: "operational" },
    { id: "comp-assessment", name: "Assessment", group: "Learning", status: "operational" },
    { id: "comp-billing", name: "Billing", group: "Platform", status: "operational" },
  ],
  activeIncidents: [],
  recentIncidents: [
    {
      id: "inc-seed-1",
      title: "Elevated tutor latency",
      resolvedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
      impact: "minor",
    },
  ],
  upcomingMaintenances: [],
  generatedAt: new Date().toISOString(),
};

export async function getPublicSummary(
  tenantId?: string,
  opts: { requestId?: string } = {},
): Promise<PublicSummary> {
  const qs = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : "";
  const res = await callService<PublicSummary>({
    service: STATUS,
    baseUrl: statusBase(),
    url: `/api/statuspage/public/summary${qs}`,
    requestId: opts.requestId,
  });
  return res.ok ? res.data : SAMPLE_SUMMARY;
}

export async function listComponents(
  opts: { requestId?: string } = {},
): Promise<StatusComponent[]> {
  const res = await callService<{ components: StatusComponent[] }>({
    service: STATUS,
    baseUrl: statusBase(),
    url: "/api/statuspage/components",
    requestId: opts.requestId,
  });
  return res.ok ? res.data.components : SAMPLE_SUMMARY.components;
}

export async function listIncidents(
  opts: { active?: boolean; requestId?: string } = {},
): Promise<StatusIncident[]> {
  const qs = opts.active ? "?active=true" : "";
  const res = await callService<{ incidents: StatusIncident[] }>({
    service: STATUS,
    baseUrl: statusBase(),
    url: `/api/statuspage/incidents${qs}`,
    requestId: opts.requestId,
  });
  return res.ok ? res.data.incidents : [];
}

export async function getIncident(
  id: string,
  opts: { requestId?: string } = {},
): Promise<{ incident: StatusIncident; updates: IncidentUpdate[] } | null> {
  const res = await callService<{ incident: StatusIncident; updates: IncidentUpdate[] }>({
    service: STATUS,
    baseUrl: statusBase(),
    url: `/api/statuspage/incidents/${encodeURIComponent(id)}`,
    requestId: opts.requestId,
  });
  return res.ok ? res.data : null;
}

export async function listMaintenances(
  opts: { requestId?: string } = {},
): Promise<StatusMaintenance[]> {
  const res = await callService<{ maintenances: StatusMaintenance[] }>({
    service: STATUS,
    baseUrl: statusBase(),
    url: "/api/statuspage/maintenances",
    requestId: opts.requestId,
  });
  return res.ok ? res.data.maintenances : [];
}

export interface SloBudget {
  sloId: string;
  service: string;
  tenantId: string | null;
  target: number;
  windowDays: number;
  errorBudget: number;
  remaining: number;
  consumedFraction: number;
  observedSli: number;
  burnRate: number;
  hoursToExhaustion: number;
  pageRecommended: boolean;
}

const SAMPLE_BUDGETS: SloBudget[] = [
  {
    sloId: "slo-api-availability",
    service: "api-gateway",
    tenantId: null,
    target: 0.999,
    windowDays: 30,
    errorBudget: 10000,
    remaining: 8000,
    consumedFraction: 0.2,
    observedSli: 0.9998,
    burnRate: 0.2,
    hoursToExhaustion: Infinity,
    pageRecommended: false,
  },
];

export async function listSlos(
  opts: { requestId?: string } = {},
): Promise<Record<string, unknown>[]> {
  const res = await callService<{ slos: Record<string, unknown>[] }>({
    service: ALERTS,
    baseUrl: alertsBase(),
    url: "/api/alerts/slos",
    requestId: opts.requestId,
  });
  return res.ok ? res.data.slos : [];
}

export async function getBudgets(
  service?: string,
  tenantId?: string,
  opts: { requestId?: string } = {},
): Promise<SloBudget[]> {
  const params = new URLSearchParams();
  if (service) params.set("service", service);
  if (tenantId) params.set("tenantId", tenantId);
  const res = await callService<{ budgets: SloBudget[] }>({
    service: ALERTS,
    baseUrl: alertsBase(),
    url: `/api/alerts/budget${params.toString() ? `?${params}` : ""}`,
    requestId: opts.requestId,
  });
  return res.ok ? res.data.budgets : SAMPLE_BUDGETS;
}

export async function getTenantHealth(
  tenantId: string,
  opts: { requestId?: string } = {},
): Promise<{ overall: string; signals: HealthSignal[] }> {
  const res = await callService<{ overall: string; signals: HealthSignal[] }>({
    service: ALERTS,
    baseUrl: alertsBase(),
    url: `/api/alerts/health-tenant?tenantId=${encodeURIComponent(tenantId)}`,
    requestId: opts.requestId,
  });
  return res.ok ? res.data : { overall: "healthy", signals: [] };
}
