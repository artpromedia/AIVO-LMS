import type { FastifyInstance } from "fastify";
import type { AuditEventInput, AuditStore } from "../services/audit-store.js";

export function registerAuditEventRoutes(app: FastifyInstance, store: AuditStore): void {
  app.post<{ Body: AuditEventInput }>("/api/audit-events", async (request, reply) => {
    const body = request.body;
    if (!body?.action || !body?.resourceType || !body?.actorRole) {
      return reply.code(400).send({ error: "action, resourceType, and actorRole are required" });
    }
    const record = await store.append(body);
    return reply.code(201).send(record);
  });

  app.get<{ Querystring: { tenantId?: string; learnerId?: string; action?: string } }>(
    "/api/audit-events",
    async (request) => {
      const records = await store.list(request.query ?? {});
      return { events: records };
    },
  );
}
