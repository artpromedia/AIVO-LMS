import type { FastifyInstance } from "fastify";
import { emitAuditEvent } from "@aivo/audit-svc";
import { InMemoryDpaStore, type DpaAcceptanceInput } from "../services/dpa-store.js";

const STORE = new InMemoryDpaStore();

export function getDpaStoreForTest(): InMemoryDpaStore {
  return STORE;
}

export function registerDpaRoutes(app: FastifyInstance): void {
  app.post<{ Body: DpaAcceptanceInput }>("/api/dpa/accept", async (request, reply) => {
    const body = request.body;
    if (!body?.districtId || !body?.version || !body?.acceptedById || !body?.acceptedByRole) {
      return reply.code(400).send({ error: "Missing required DPA fields" });
    }
    const record = STORE.acceptDpa(body);
    void emitAuditEvent({
      actorId: body.acceptedById,
      actorRole: body.acceptedByRole,
      action: "dpa_accepted",
      resourceType: "dpa",
      resourceId: record.id,
      metadata: {
        districtId: record.districtId,
        version: record.version,
      },
    });
    return reply.code(201).send(record);
  });

  app.get<{ Params: { districtId: string } }>(
    "/api/dpa/:districtId/latest",
    async (request, reply) => {
      const record = STORE.latestForDistrict(request.params.districtId);
      if (!record) return reply.code(404).send({ error: "No DPA acceptance found" });
      return record;
    },
  );
}
