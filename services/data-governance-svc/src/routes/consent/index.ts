/**
 * Consent ledger routes (Sprint 5). View is allowed for any admin scoped
 * to their own tenant; platform admins see everything. Recording/revoking
 * consent captures the verifying actor (COPPA).
 */
import type { FastifyInstance } from "fastify";
import { emitAuditEvent } from "@aivo/audit-svc";
import {
  actorOf,
  isPlatformAdmin,
  isDistrictAdmin,
  isSchoolAdmin,
  tenantScopeFor,
} from "../context.js";
import {
  recordConsent,
  revokeConsent,
  searchConsents,
  type RecordConsentInput,
} from "../../services/consent-store.js";

export function registerConsentRoutes(app: FastifyInstance): void {
  app.post<{ Body: Partial<RecordConsentInput> }>("/consent", async (request, reply) => {
    const actor = actorOf(request);
    const body = request.body ?? {};
    if (!body.subjectId || !body.consentType || typeof body.granted !== "boolean") {
      return reply.code(400).send({ error: "subjectId, consentType, granted are required" });
    }
    const rec = recordConsent({
      tenantId: body.tenantId ?? actor.tenantId,
      subjectId: body.subjectId,
      subjectType: body.subjectType,
      consentType: body.consentType,
      granted: body.granted,
      actorId: body.actorId ?? actor.actorId,
      actorRole: body.actorRole ?? actor.actorRole,
      method: body.method,
      policyVersion: body.policyVersion,
    });
    void emitAuditEvent({
      actorId: rec.actorId ?? undefined,
      actorRole: rec.actorRole ?? "system",
      action: rec.granted ? "consent_granted" : "consent_recorded",
      resourceType: "consent",
      resourceId: rec.id,
      metadata: { consentType: rec.consentType, subjectId: rec.subjectId },
    });
    return reply.code(201).send(rec);
  });

  app.get<{ Querystring: { subjectId?: string; consentType?: string } }>(
    "/consent",
    async (request, reply) => {
      const actor = actorOf(request);
      // View consent ledger: platform / district / school admins (scoped).
      if (!isPlatformAdmin(actor) && !isDistrictAdmin(actor) && !isSchoolAdmin(actor)) {
        return reply.code(403).send({ error: "admin role required" });
      }
      const records = searchConsents({
        subjectId: request.query.subjectId,
        consentType: request.query.consentType,
        tenantScope: tenantScopeFor(actor),
      });
      return { consents: records };
    },
  );

  app.post<{ Body: { subjectId?: string; consentType?: string } }>(
    "/consent/revoke",
    async (request, reply) => {
      const actor = actorOf(request);
      const { subjectId, consentType } = request.body ?? {};
      if (!subjectId || !consentType) {
        return reply.code(400).send({ error: "subjectId and consentType are required" });
      }
      const rec = revokeConsent({
        subjectId,
        consentType,
        actorId: actor.actorId,
        actorRole: actor.actorRole,
      });
      void emitAuditEvent({
        actorId: actor.actorId ?? undefined,
        actorRole: actor.actorRole ?? "system",
        action: "consent_revoked",
        resourceType: "consent",
        resourceId: rec?.id ?? subjectId,
        metadata: { consentType, subjectId },
      });
      return reply.code(201).send(rec);
    },
  );
}
