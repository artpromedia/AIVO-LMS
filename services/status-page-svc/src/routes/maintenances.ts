/**
 * Scheduled maintenance with notification windows (Sprint 8).
 *   GET   /api/statuspage/maintenances
 *   POST  /api/statuspage/maintenances           (platform only)
 *   PATCH /api/statuspage/maintenances/:id        (platform only)
 */
import type { FastifyInstance } from "fastify";
import { getStatusStore, spId } from "../statuspage/store.js";
import type { Maintenance, MaintenanceState } from "../statuspage/types.js";
import { requirePlatformAdmin } from "../statuspage/rbac.js";
import { emitStatusAudit } from "../statuspage/audit.js";

const STATES: MaintenanceState[] = ["scheduled", "in_progress", "completed", "cancelled"];

export function registerMaintenanceRoutes(app: FastifyInstance): void {
  const base = "/api/statuspage/maintenances";

  app.get(base, async () => {
    const store = getStatusStore();
    const maintenances = [...store.maintenances.values()].sort((a, b) =>
      a.scheduledStart.localeCompare(b.scheduledStart),
    );
    return { maintenances };
  });

  app.post<{ Body: Partial<Maintenance> }>(
    base,
    { preHandler: requirePlatformAdmin() },
    async (request, reply) => {
      const b = request.body ?? {};
      if (!b.title || !b.scheduledStart || !b.scheduledEnd) {
        return reply.code(400).send({ error: "title, scheduledStart, scheduledEnd are required" });
      }
      const store = getStatusStore();
      const maintenance: Maintenance = {
        id: spId("mnt"),
        title: b.title,
        description: b.description ?? "",
        componentIds: b.componentIds ?? [],
        state: "scheduled",
        scheduledStart: b.scheduledStart,
        scheduledEnd: b.scheduledEnd,
        notifyLeadMinutes: b.notifyLeadMinutes ?? 60,
        createdBy: (request as any).actorRole ?? "platform_admin",
        createdAt: new Date().toISOString(),
      };
      store.maintenances.set(maintenance.id, maintenance);
      await emitStatusAudit(request, "STATUS_MAINTENANCE_SCHEDULED", maintenance.id, {
        start: maintenance.scheduledStart,
      });
      return reply.code(201).send({ maintenance });
    },
  );

  app.patch<{ Params: { id: string }; Body: Partial<Maintenance> }>(
    `${base}/:id`,
    { preHandler: requirePlatformAdmin() },
    async (request, reply) => {
      const store = getStatusStore();
      const existing = store.maintenances.get(request.params.id);
      if (!existing) return reply.code(404).send({ error: "Maintenance not found" });
      const b = request.body ?? {};
      const nextState =
        b.state && STATES.includes(b.state) ? b.state : existing.state;
      const updated: Maintenance = {
        ...existing,
        title: b.title ?? existing.title,
        description: b.description ?? existing.description,
        componentIds: b.componentIds ?? existing.componentIds,
        state: nextState,
        scheduledStart: b.scheduledStart ?? existing.scheduledStart,
        scheduledEnd: b.scheduledEnd ?? existing.scheduledEnd,
        notifyLeadMinutes: b.notifyLeadMinutes ?? existing.notifyLeadMinutes,
      };
      // Reflect in-progress maintenance on its components.
      if (nextState === "in_progress") {
        for (const cid of updated.componentIds) {
          const c = store.components.get(cid);
          if (c) {
            c.status = "under_maintenance";
            c.updatedAt = new Date().toISOString();
          }
        }
      } else if (nextState === "completed" || nextState === "cancelled") {
        for (const cid of updated.componentIds) {
          const c = store.components.get(cid);
          if (c && c.status === "under_maintenance") {
            c.status = "operational";
            c.updatedAt = new Date().toISOString();
          }
        }
      }
      store.maintenances.set(updated.id, updated);
      await emitStatusAudit(request, "STATUS_MAINTENANCE_UPDATED", updated.id, { state: nextState });
      return { maintenance: updated };
    },
  );
}
