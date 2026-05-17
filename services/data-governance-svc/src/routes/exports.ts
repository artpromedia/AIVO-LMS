import type { FastifyInstance } from "fastify";
import { emitAuditEvent } from "@aivo/audit-svc";
import { buildParentExport, type ParentExportInput } from "../services/export-builder.js";

export function registerExportRoutes(app: FastifyInstance): void {
  app.post<{ Body: ParentExportInput }>("/api/exports/parent", async (request, reply) => {
    const body = request.body;
    if (!body?.learnerId) {
      return reply.code(400).send({ error: "learnerId is required" });
    }
    void emitAuditEvent({
      actorRole: "parent",
      action: "learner_data_export_requested",
      resourceType: "data_export",
      learnerId: body.learnerId,
    });
    const job = buildParentExport(body);
    void emitAuditEvent({
      actorRole: "parent",
      action: "learner_data_export_completed",
      resourceType: "data_export",
      resourceId: job.id,
      learnerId: body.learnerId,
      metadata: { formats: job.formats },
    });
    return reply.send(job);
  });
}
