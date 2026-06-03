/**
 * Public summary JSON consumed by the unauthenticated public status page
 * (Sprint 8). No auth; the BFF caches this for 30s. Optionally scoped to a
 * tenant via ?tenantId= to power district/school views.
 *   GET /api/statuspage/public/summary
 */
import type { FastifyInstance } from "fastify";
import {
  getStatusStore,
  effectiveComponentStatus,
  overallStatus,
} from "../statuspage/store.js";

export function registerPublicSummaryRoutes(app: FastifyInstance): void {
  app.get<{ Querystring: { tenantId?: string } }>(
    "/api/statuspage/public/summary",
    async (request, reply) => {
      const store = getStatusStore();
      const tenantId = request.query.tenantId;

      const isVisible = (affectedTenants: string[]) =>
        !tenantId || affectedTenants.length === 0 || affectedTenants.includes(tenantId);

      const components = [...store.components.values()]
        .filter((c) => isVisible(c.affectedTenants))
        .sort((a, b) => a.order - b.order)
        .map((c) => ({
          id: c.id,
          name: c.name,
          group: c.group,
          status: effectiveComponentStatus(store, c.id),
        }));

      const activeIncidents = [...store.incidents.values()]
        .filter((i) => i.lifecycle !== "resolved" && isVisible(i.affectedTenants))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((i) => ({
          id: i.id,
          title: i.title,
          lifecycle: i.lifecycle,
          impact: i.impact,
          affectedComponentIds: i.affectedComponentIds,
          updatedAt: i.updatedAt,
        }));

      const recentIncidents = [...store.incidents.values()]
        .filter((i) => i.lifecycle === "resolved" && isVisible(i.affectedTenants))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 10)
        .map((i) => ({ id: i.id, title: i.title, resolvedAt: i.resolvedAt, impact: i.impact }));

      const upcomingMaintenances = [...store.maintenances.values()]
        .filter((m) => m.state === "scheduled" || m.state === "in_progress")
        .sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart))
        .map((m) => ({
          id: m.id,
          title: m.title,
          state: m.state,
          scheduledStart: m.scheduledStart,
          scheduledEnd: m.scheduledEnd,
        }));

      reply.header("cache-control", "public, max-age=30");
      return {
        overall: tenantId ? overallForComponents(components) : overallStatus(store),
        components,
        activeIncidents,
        recentIncidents,
        upcomingMaintenances,
        generatedAt: new Date().toISOString(),
      };
    },
  );
}

const RANK: Record<string, number> = {
  operational: 0,
  under_maintenance: 1,
  degraded_performance: 2,
  partial_outage: 3,
  major_outage: 4,
};
function overallForComponents(components: Array<{ status: string }>): string {
  let worst = "operational";
  for (const c of components) {
    if ((RANK[c.status] ?? 0) > (RANK[worst] ?? 0)) worst = c.status;
  }
  return worst;
}
