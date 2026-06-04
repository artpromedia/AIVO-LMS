/**
 * Incident updates feed (Sprint 8).
 *   GET  /api/statuspage/updates?incidentId=...    feed (newest first)
 *   POST /api/statuspage/incidents/:id/updates     post a standalone update
 */
import type { FastifyInstance } from "fastify";
import { getStatusStore } from "../statuspage/store.js";
import type { IncidentLifecycle } from "../statuspage/types.js";
import { requirePlatformAdmin } from "../statuspage/rbac.js";
import { appendUpdate } from "./statuspage-incidents.js";
import { emitStatusAudit } from "../statuspage/audit.js";

export function registerUpdateRoutes(app: FastifyInstance): void {
  app.get<{ Querystring: { incidentId?: string } }>("/api/statuspage/updates", async (request) => {
    const store = getStatusStore();
    let updates = [...store.updates.values()];
    if (request.query.incidentId) {
      updates = updates.filter((u) => u.incidentId === request.query.incidentId);
    }
    updates.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { updates };
  });

  app.post<{ Params: { id: string }; Body: { body?: string; lifecycle?: IncidentLifecycle } }>(
    "/api/statuspage/incidents/:id/updates",
    { preHandler: requirePlatformAdmin() },
    async (request, reply) => {
      const store = getStatusStore();
      const incident = store.incidents.get(request.params.id);
      if (!incident) return reply.code(404).send({ error: "Incident not found" });
      const b = request.body ?? {};
      if (!b.body) return reply.code(400).send({ error: "body is required" });
      const update = appendUpdate(
        incident.id,
        b.lifecycle ?? incident.lifecycle,
        b.body,
        (request as any).actorRole ?? "platform_admin",
      );
      await emitStatusAudit(request, "STATUS_INCIDENT_UPDATED", incident.id, { kind: "note" });
      return reply.code(201).send({ update });
    },
  );
}
