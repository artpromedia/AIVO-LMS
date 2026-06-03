/**
 * alerts-proxy-svc routes (Sprint 8): SLOs, error budgets, alert intake
 * with dedupe + auto-incident, and per-tenant health aggregation.
 *
 * These augment the existing /api/alerts/page proxy. They are registered
 * by buildServer() so the whole surface lives on one Fastify instance.
 */
import type { FastifyInstance } from "fastify";
import {
  computeErrorBudget,
  burnRate,
  timeToExhaustionHours,
  shouldPageOnBurn,
  type SloDefinition,
} from "./slo/slo-math.js";
import { getSloStore, observedFor, sloId } from "./slo/store.js";
import {
  AlertDeduper,
  fingerprintOf,
  severityFromAlert,
  tenantFromAlert,
  type PromAlert,
} from "./slo/dedupe.js";

export interface AlertRouteDeps {
  /** Injectable fetch for the auto-incident call (tests). */
  fetchImpl?: typeof fetch;
  /** status-page-svc base URL for auto-incident creation. */
  statusPageUrl?: string;
  /** Shared deduper (so tests can inspect it); defaults to a 5m window. */
  deduper?: AlertDeduper;
}

const BURN_PAGE_THRESHOLD = 2; // page when burning ≥2x budget

export function registerSloRoutes(app: FastifyInstance): void {
  const base = "/api/alerts/slos";

  app.get(base, async () => ({ slos: [...getSloStore().slos.values()] }));

  app.post<{ Body: Partial<SloDefinition> }>(base, async (request, reply) => {
    const b = request.body ?? {};
    if (!b.service || b.target === undefined || !b.name) {
      return reply.code(400).send({ error: "service, name, target are required" });
    }
    if (b.target <= 0 || b.target >= 1) {
      return reply.code(400).send({ error: "target must be a fraction in (0,1)" });
    }
    const store = getSloStore();
    const now = new Date().toISOString();
    const slo: SloDefinition = {
      id: b.id ?? sloId(),
      service: b.service,
      tenantId: b.tenantId ?? null,
      name: b.name,
      target: b.target,
      windowDays: b.windowDays ?? 30,
      indicatorQuery: b.indicatorQuery ?? "",
      createdAt: now,
      updatedAt: now,
    };
    store.slos.set(slo.id, slo);
    return reply.code(201).send({ slo });
  });

  app.put<{ Params: { id: string }; Body: Partial<SloDefinition> }>(
    `${base}/:id`,
    async (request, reply) => {
      const store = getSloStore();
      const existing = store.slos.get(request.params.id);
      if (!existing) return reply.code(404).send({ error: "SLO not found" });
      const b = request.body ?? {};
      const updated: SloDefinition = {
        ...existing,
        name: b.name ?? existing.name,
        target: b.target ?? existing.target,
        windowDays: b.windowDays ?? existing.windowDays,
        indicatorQuery: b.indicatorQuery ?? existing.indicatorQuery,
        tenantId: b.tenantId ?? existing.tenantId,
        updatedAt: new Date().toISOString(),
      };
      store.slos.set(updated.id, updated);
      return { slo: updated };
    },
  );
}

export function registerBudgetRoutes(app: FastifyInstance): void {
  // GET /api/alerts/budget?service=...&tenantId=...
  app.get<{ Querystring: { service?: string; tenantId?: string; sloId?: string } }>(
    "/api/alerts/budget",
    async (request, reply) => {
      const store = getSloStore();
      const { service, tenantId, sloId: id } = request.query;

      const slos = [...store.slos.values()].filter((s) => {
        if (id) return s.id === id;
        if (service && s.service !== service) return false;
        return true;
      });
      if (slos.length === 0) return reply.code(404).send({ error: "No matching SLO" });

      const budgets = slos.map((slo) => {
        const obs = observedFor(store, slo.service, tenantId ?? slo.tenantId);
        const budget = computeErrorBudget({
          target: slo.target,
          goodEvents: obs.goodEvents,
          badEvents: obs.badEvents,
        });
        const observedBadRate = budget.totalEvents === 0 ? 0 : obs.badEvents / budget.totalEvents;
        const burn = burnRate(slo.target, observedBadRate);
        return {
          sloId: slo.id,
          service: slo.service,
          tenantId: tenantId ?? slo.tenantId,
          target: slo.target,
          windowDays: slo.windowDays,
          ...budget,
          burnRate: burn,
          hoursToExhaustion: timeToExhaustionHours(slo.windowDays, burn),
          pageRecommended: shouldPageOnBurn({
            fastWindowBurn: burn,
            slowWindowBurn: burn,
            threshold: BURN_PAGE_THRESHOLD,
          }),
        };
      });

      return { budgets };
    },
  );
}

export function registerAlertIntakeRoutes(app: FastifyInstance, deps: AlertRouteDeps = {}): void {
  const deduper = deps.deduper ?? new AlertDeduper();
  const doFetch = deps.fetchImpl ?? fetch;
  const statusPageUrl = (
    deps.statusPageUrl ??
    process.env.STATUS_PAGE_SVC_URL ??
    "http://localhost:3014"
  ).replace(/\/+$/, "");

  // Prometheus / Alertmanager webhook intake.
  app.post<{ Body: { alerts?: PromAlert[] } }>("/api/alerts/webhook", async (request, reply) => {
    const alerts = request.body?.alerts ?? [];
    if (!Array.isArray(alerts)) {
      return reply.code(400).send({ error: "alerts array required" });
    }
    const routed: Array<Record<string, unknown>> = [];
    const suppressed: string[] = [];

    for (const alert of alerts) {
      if (!alert || typeof alert !== "object" || !alert.labels) continue;
      const fp = fingerprintOf(alert);
      if (!deduper.accept(alert)) {
        suppressed.push(fp);
        continue;
      }
      const severity = severityFromAlert(alert);
      const tenantId = tenantFromAlert(alert);
      const decision: Record<string, unknown> = {
        fingerprint: fp,
        severity,
        tenantId,
        status: alert.status,
        alertname: alert.labels.alertname ?? "unknown",
      };

      // Critical firing alerts auto-open a status-page incident so the
      // public page reflects the outage within seconds.
      if (severity === "critical" && alert.status === "firing") {
        decision.autoIncident = await openAutoIncident(
          doFetch,
          statusPageUrl,
          alert,
          tenantId,
        );
      }
      routed.push(decision);
    }

    return { received: alerts.length, routed: routed.length, suppressed: suppressed.length, decisions: routed };
  });
}

async function openAutoIncident(
  doFetch: typeof fetch,
  statusPageUrl: string,
  alert: PromAlert,
  tenantId: string | null,
): Promise<{ created: boolean; incidentId?: string; error?: string }> {
  try {
    const res = await doFetch(`${statusPageUrl}/api/statuspage/incidents`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        // Service-to-service: present platform role so RBAC permits the write.
        "x-actor-role": "platform_admin",
        "x-service-token": process.env.INTERNAL_SERVICE_TOKEN ?? "aivo-internal-dev-token",
      },
      body: JSON.stringify({
        title: alert.annotations?.summary ?? alert.labels.alertname ?? "Automated incident",
        impact: "critical",
        affectedComponentIds: alert.labels.component ? [alert.labels.component] : [],
        affectedTenants: tenantId ? [tenantId] : [],
        message: alert.annotations?.description ?? "Auto-opened from Alertmanager.",
      }),
    });
    if (!res.ok) return { created: false, error: `status ${res.status}` };
    const body = (await res.json()) as { incident?: { id: string } };
    return { created: true, incidentId: body.incident?.id };
  } catch (err) {
    return { created: false, error: (err as Error).message };
  }
}

export function registerTenantHealthRoutes(app: FastifyInstance): void {
  // GET /api/alerts/health-tenant?tenantId=... aggregates per-tenant signals.
  app.get<{ Querystring: { tenantId?: string } }>(
    "/api/alerts/health-tenant",
    async (request) => {
      const store = getSloStore();
      const tenantId = request.query.tenantId ?? null;
      const signals = [...store.slos.values()].map((slo) => {
        const obs = observedFor(store, slo.service, tenantId);
        const budget = computeErrorBudget({
          target: slo.target,
          goodEvents: obs.goodEvents,
          badEvents: obs.badEvents,
        });
        const meeting = budget.observedSli >= slo.target;
        return {
          service: slo.service,
          slo: slo.name,
          observedSli: budget.observedSli,
          target: slo.target,
          budgetRemaining: budget.remaining,
          status: meeting ? "healthy" : budget.remaining > 0 ? "at_risk" : "breaching",
        };
      });
      const worst = signals.some((s) => s.status === "breaching")
        ? "breaching"
        : signals.some((s) => s.status === "at_risk")
          ? "at_risk"
          : "healthy";
      return { tenantId, overall: worst, signals, checkedAt: new Date().toISOString() };
    },
  );
}
