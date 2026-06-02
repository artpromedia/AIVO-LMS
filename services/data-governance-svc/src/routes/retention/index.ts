/**
 * Retention-policy routes (Sprint 5): list policies, edit a per-class
 * policy, and a "what would be deleted" dry-run preview. Configuring
 * retention is platform-admin only (RBAC table).
 */
import type { FastifyInstance } from "fastify";
import { emitAuditEvent } from "@aivo/audit-svc";
import { actorOf, requirePlatformAdmin, isPlatformAdmin, isDistrictAdmin } from "../context.js";
import {
  listRetentionPolicies,
  setRetentionPolicy,
  getDataClass,
} from "../../services/catalog-store.js";
import {
  previewRetention,
  totalEligible,
  type RetentionRecord,
} from "../../domain/retention-preview.js";

export function registerRetentionPolicyRoutes(app: FastifyInstance): void {
  app.get("/retention/policies", async (request, reply) => {
    const actor = actorOf(request);
    if (!isPlatformAdmin(actor) && !isDistrictAdmin(actor)) {
      return reply.code(403).send({ error: "admin role required" });
    }
    const tenantId = isPlatformAdmin(actor) ? null : actor.tenantId;
    return { policies: listRetentionPolicies(tenantId) };
  });

  app.put<{
    Params: { dataClass: string };
    Body: {
      retentionDays?: number | null;
      disposition?: "purge" | "anonymize";
      legalHold?: boolean;
      tenantId?: string | null;
    };
  }>("/retention/policies/:dataClass", async (request, reply) => {
    const actor = requirePlatformAdmin(request, reply);
    if (!actor) return;
    const { dataClass } = request.params;
    if (!getDataClass(dataClass)) {
      return reply.code(404).send({ error: `unknown data class: ${dataClass}` });
    }
    const body = request.body ?? {};
    const updated = setRetentionPolicy({
      dataClass,
      tenantId: body.tenantId ?? null,
      retentionDays: body.retentionDays ?? null,
      disposition: body.disposition ?? "purge",
      legalHold: body.legalHold ?? false,
      updatedById: actor.actorId,
    });
    void emitAuditEvent({
      actorId: actor.actorId ?? undefined,
      actorRole: actor.actorRole ?? "system",
      action: "retention_policy_updated",
      resourceType: "retention_policy",
      resourceId: dataClass,
      metadata: { retentionDays: updated.retentionDays, disposition: updated.disposition },
    });
    return updated;
  });

  /**
   * Dry-run preview. The caller passes a sample of records
   * (`{ dataClass, recordId, createdAt }`) — typically a representative
   * slice surfaced by the owning services — and gets back per-class
   * eligible counts under the current policies. Read-only; mutates nothing.
   */
  app.post<{ Body: { records?: RetentionRecord[]; tenantId?: string | null } }>(
    "/retention/preview",
    async (request, reply) => {
      const actor = actorOf(request);
      if (!isPlatformAdmin(actor) && !isDistrictAdmin(actor)) {
        return reply.code(403).send({ error: "admin role required" });
      }
      const tenantId = isPlatformAdmin(actor) ? (request.body?.tenantId ?? null) : actor.tenantId;
      const records = request.body?.records ?? [];
      const policies = listRetentionPolicies(tenantId);
      const preview = previewRetention({ policies, records });
      return { preview, totalEligible: totalEligible(preview) };
    },
  );
}
