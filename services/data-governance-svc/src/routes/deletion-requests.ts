import type { FastifyInstance } from "fastify";
import { emitAuditEvent } from "@aivo/audit-svc";
import {
  approveDeletion,
  createDeletionRequest,
  finalizeHardDelete,
  markReadyForHardDelete,
  type DeletionRequest,
  type DeletionWorkflowInput,
} from "../services/deletion-workflow.js";

const STORE = new Map<string, DeletionRequest>();

export function clearDeletionStoreForTest(): void {
  STORE.clear();
}

export function registerDeletionRoutes(app: FastifyInstance): void {
  app.post<{ Body: DeletionWorkflowInput }>("/api/deletion-requests", async (request, reply) => {
    if (!request.body?.learnerId || !request.body?.requesterId) {
      return reply.code(400).send({ error: "learnerId and requesterId are required" });
    }
    const record = createDeletionRequest({
      learnerId: request.body.learnerId,
      requesterId: request.body.requesterId,
      requesterRole: request.body.requesterRole,
      exportBeforeDelete: request.body.exportBeforeDelete,
      retentionHolds: request.body.retentionHolds ?? [],
    });
    STORE.set(record.id, record);
    void emitAuditEvent({
      actorId: request.body.requesterId,
      actorRole: request.body.requesterRole,
      action: "deletion_requested",
      resourceType: "deletion_request",
      resourceId: record.id,
      learnerId: record.learnerId,
      metadata: { status: record.status },
    });
    return reply.code(201).send(record);
  });

  app.post<{ Params: { id: string } }>(
    "/api/deletion-requests/:id/approve",
    async (request, reply) => {
      const existing = STORE.get(request.params.id);
      if (!existing) return reply.code(404).send({ error: "Not found" });
      try {
        const updated = approveDeletion(existing);
        STORE.set(updated.id, updated);
        void emitAuditEvent({
          actorRole: "platform_admin",
          action: "deletion_approved",
          resourceType: "deletion_request",
          resourceId: updated.id,
          learnerId: updated.learnerId,
          metadata: { status: updated.status },
        });
        return updated;
      } catch (error) {
        return reply.code(409).send({ error: (error as Error).message });
      }
    },
  );

  app.post<{ Params: { id: string } }>(
    "/api/deletion-requests/:id/ready-for-hard-delete",
    async (request, reply) => {
      const existing = STORE.get(request.params.id);
      if (!existing) return reply.code(404).send({ error: "Not found" });
      try {
        const updated = markReadyForHardDelete(existing);
        STORE.set(updated.id, updated);
        return updated;
      } catch (error) {
        return reply.code(409).send({ error: (error as Error).message });
      }
    },
  );

  app.post<{ Params: { id: string } }>(
    "/api/deletion-requests/:id/finalize",
    async (request, reply) => {
      const existing = STORE.get(request.params.id);
      if (!existing) return reply.code(404).send({ error: "Not found" });
      try {
        const updated = finalizeHardDelete(existing);
        STORE.set(updated.id, updated);
        void emitAuditEvent({
          actorRole: "platform_admin",
          action: "deletion_completed",
          resourceType: "deletion_request",
          resourceId: updated.id,
          learnerId: updated.learnerId,
          metadata: { status: updated.status },
        });
        return updated;
      } catch (error) {
        return reply.code(409).send({ error: (error as Error).message });
      }
    },
  );
}
