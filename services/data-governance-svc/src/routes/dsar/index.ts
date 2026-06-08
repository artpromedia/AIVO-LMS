/**
 * DSAR intake + lifecycle routes (Sprint 5).
 *
 * Intake (`POST /dsar`) is open to anyone with a verified identity OR a
 * parent acting for a learner under 13 (COPPA). The queue and lifecycle
 * transitions require a DSAR processor (platform or district admin, the
 * latter scoped to their own district). Erasure-type fulfillment runs the
 * erasure fan-out; access/portability runs the export fan-out and attaches
 * the bundle as evidence.
 */
import type { FastifyInstance } from "fastify";
import { emitAuditEvent } from "@aivo/audit-svc";
import {
  actorOf,
  requireDsarProcessor,
  tenantScopeFor,
  isPlatformAdmin,
  isDistrictAdmin,
} from "../context.js";
import {
  createDsar,
  getDsar,
  getTimeline,
  listDsars,
  assignDsar,
  approveDsar,
  rejectDsar,
  startFulfillment,
  fulfillDsar,
  verifyIdentity,
  recordServiceResponse,
  slaStatusFor,
  computeKpis,
  type CreateDsarInput,
  type DsarStatus,
  type DsarType,
} from "../../services/dsar-store.js";
import { runErasureFanout } from "../../orchestrator/erasure.js";
import { runExportFanout, validateArt20Bundle } from "../../orchestrator/export.js";

const DSAR_TYPES = new Set<DsarType>([
  "access",
  "erasure",
  "portability",
  "rectification",
  "restriction",
  "objection",
]);

export function registerDsarRoutes(app: FastifyInstance): void {
  // ── Intake ─────────────────────────────────────────────────────────────────
  app.post<{ Body: Partial<CreateDsarInput> & { type?: string } }>(
    "/dsar",
    async (request, reply) => {
      const body = request.body ?? {};
      const actor = actorOf(request);
      if (!body.type || !DSAR_TYPES.has(body.type as DsarType)) {
        return reply.code(400).send({ error: "valid 'type' is required", types: [...DSAR_TYPES] });
      }
      if (!body.subjectId) {
        return reply.code(400).send({ error: "subjectId is required" });
      }
      // Open intake requires EITHER an authenticated requester OR a
      // parent-on-behalf-of-minor declaration (COPPA path).
      const hasVerifiedIdentity = Boolean(actor.actorId);
      if (!hasVerifiedIdentity && !body.onBehalfOfMinor) {
        return reply
          .code(401)
          .send({ error: "intake requires a verified identity or an on-behalf-of-minor request" });
      }

      const record = await createDsar({
        tenantId: body.tenantId ?? actor.tenantId,
        type: body.type as DsarType,
        regulations: body.regulations,
        subjectId: body.subjectId,
        subjectType: body.subjectType,
        subjectEmail: body.subjectEmail ?? null,
        requesterId: body.requesterId ?? actor.actorId,
        requesterRole: body.requesterRole ?? actor.actorRole,
        onBehalfOfMinor: body.onBehalfOfMinor,
        slaOverride: body.slaOverride,
      });
      void emitAuditEvent({
        actorId: record.requesterId ?? undefined,
        actorRole: record.requesterRole ?? "system",
        action: "dsar_requested",
        resourceType: "dsar_request",
        resourceId: record.id,
        metadata: { type: record.type, subjectId: record.subjectId },
      });
      return reply.code(201).send(record);
    },
  );

  // ── Admin queue ──────────────────────────────────────────────────────────────
  app.get<{ Querystring: { status?: string } }>("/dsar", async (request, reply) => {
    const actor = requireDsarProcessor(request, reply);
    if (!actor) return;
    const status = request.query.status as DsarStatus | undefined;
    const list = await listDsars({ status, tenantScope: tenantScopeFor(actor) });
    const now = new Date();
    return {
      requests: list.map((r) => ({ ...r, sla: slaStatusFor(r, now) })),
      kpis: computeKpis(list, now),
    };
  });

  // ── Detail + timeline + evidence ─────────────────────────────────────────────
  app.get<{ Params: { id: string } }>("/dsar/:id", async (request, reply) => {
    const actor = requireDsarProcessor(request, reply);
    if (!actor) return;
    const record = await getDsar(request.params.id);
    if (!record) return reply.code(404).send({ error: "Not found" });
    if (!canAccess(actor, record.tenantId)) return reply.code(403).send({ error: "Out of scope" });
    return { request: record, timeline: await getTimeline(record.id), sla: slaStatusFor(record) };
  });

  app.post<{ Params: { id: string }; Body: { method?: string } }>(
    "/dsar/:id/verify-identity",
    async (request, reply) => {
      const actor = requireDsarProcessor(request, reply);
      if (!actor) return;
      const record = await getDsar(request.params.id);
      if (!record) return reply.code(404).send({ error: "Not found" });
      if (!canAccess(actor, record.tenantId))
        return reply.code(403).send({ error: "Out of scope" });
      const updated = await verifyIdentity(record.id, request.body?.method ?? "manual", actor);
      void emitAuditEvent({
        actorId: actor.actorId ?? undefined,
        actorRole: actor.actorRole ?? "system",
        action: "dsar_identity_verified",
        resourceType: "dsar_request",
        resourceId: record.id,
      });
      return updated;
    },
  );

  app.post<{ Params: { id: string }; Body: { assigneeId?: string } }>(
    "/dsar/:id/assign",
    async (request, reply) => {
      const actor = requireDsarProcessor(request, reply);
      if (!actor) return;
      const record = await getDsar(request.params.id);
      if (!record) return reply.code(404).send({ error: "Not found" });
      if (!canAccess(actor, record.tenantId))
        return reply.code(403).send({ error: "Out of scope" });
      const assigneeId = request.body?.assigneeId ?? actor.actorId ?? "unassigned";
      return assignDsar(record.id, assigneeId, actor);
    },
  );

  app.post<{ Params: { id: string } }>("/dsar/:id/approve", async (request, reply) => {
    const actor = requireDsarProcessor(request, reply);
    if (!actor) return;
    const record = await getDsar(request.params.id);
    if (!record) return reply.code(404).send({ error: "Not found" });
    if (!canAccess(actor, record.tenantId)) return reply.code(403).send({ error: "Out of scope" });
    if (!record.identityVerified) {
      return reply.code(409).send({ error: "identity must be verified before approval" });
    }
    const updated = await approveDsar(record.id, actor);
    void emitAuditEvent({
      actorId: actor.actorId ?? undefined,
      actorRole: actor.actorRole ?? "system",
      action: "dsar_approved",
      resourceType: "dsar_request",
      resourceId: record.id,
    });
    return updated;
  });

  app.post<{ Params: { id: string }; Body: { reason?: string } }>(
    "/dsar/:id/reject",
    async (request, reply) => {
      const actor = requireDsarProcessor(request, reply);
      if (!actor) return;
      const record = await getDsar(request.params.id);
      if (!record) return reply.code(404).send({ error: "Not found" });
      if (!canAccess(actor, record.tenantId))
        return reply.code(403).send({ error: "Out of scope" });
      const updated = await rejectDsar(record.id, request.body?.reason ?? "not specified", actor);
      void emitAuditEvent({
        actorId: actor.actorId ?? undefined,
        actorRole: actor.actorRole ?? "system",
        action: "dsar_rejected",
        resourceType: "dsar_request",
        resourceId: record.id,
      });
      return updated;
    },
  );

  // ── Fulfill: runs the erasure or export fan-out ──────────────────────────────
  app.post<{ Params: { id: string } }>("/dsar/:id/fulfill", async (request, reply) => {
    const actor = requireDsarProcessor(request, reply);
    if (!actor) return;
    const record = await getDsar(request.params.id);
    if (!record) return reply.code(404).send({ error: "Not found" });
    if (!canAccess(actor, record.tenantId)) return reply.code(403).send({ error: "Out of scope" });
    if (record.status !== "approved" && record.status !== "fulfilling") {
      return reply.code(409).send({ error: "request must be approved before fulfillment" });
    }
    // Erasure requires step-up for district admins (RBAC table). We honor an
    // `x-step-up-token` presence here; identity-svc does the real verify in
    // production. Platform admins are exempt at this layer.
    if (
      record.type === "erasure" &&
      isDistrictAdmin(actor) &&
      !request.headers["x-step-up-token"]
    ) {
      return reply
        .code(403)
        .send({ error: "step-up required for erasure", code: "STEP_UP_REQUIRED" });
    }

    await startFulfillment(record.id, actor);

    if (record.type === "erasure") {
      const outcome = await runErasureFanout({
        subjectId: record.subjectId,
        subjectType: record.subjectType,
        tenantId: record.tenantId,
        dsarId: record.id,
      });
      await recordServiceResponse(record.id, {
        kind: "erasure",
        checksum: outcome.checksum,
        totalErased: outcome.totalErased,
        totalAnonymized: outcome.totalAnonymized,
        failedServices: outcome.failedServices,
      });
      if (!outcome.allConfirmed) {
        return reply.code(502).send({
          error: "partial erasure fan-out — not all services confirmed",
          failedServices: outcome.failedServices,
          checksum: outcome.checksum,
        });
      }
      const updated = await fulfillDsar(
        record.id,
        {
          kind: "erasure_receipt",
          checksum: outcome.checksum,
          totalErased: outcome.totalErased,
          totalAnonymized: outcome.totalAnonymized,
          services: outcome.results.map((r) => r.service),
        },
        actor,
      );
      void emitAuditEvent({
        actorId: actor.actorId ?? undefined,
        actorRole: actor.actorRole ?? "system",
        action: "dsar_fulfilled",
        resourceType: "dsar_request",
        resourceId: record.id,
        metadata: { type: "erasure", checksum: outcome.checksum },
      });
      return { request: updated, erasure: outcome };
    }

    // access / portability / others → export bundle
    const bundle = await runExportFanout({
      subjectId: record.subjectId,
      subjectType: record.subjectType,
      tenantId: record.tenantId,
      subjectEmail: record.subjectEmail,
      dsarId: record.id,
    });
    const check = validateArt20Bundle(bundle);
    const updated = await fulfillDsar(
      record.id,
      {
        kind: "export_bundle",
        manifest: bundle.manifest,
        art20Valid: check.valid,
      },
      actor,
    );
    void emitAuditEvent({
      actorId: actor.actorId ?? undefined,
      actorRole: actor.actorRole ?? "system",
      action: "dsar_fulfilled",
      resourceType: "dsar_request",
      resourceId: record.id,
      metadata: { type: record.type, art20Valid: check.valid },
    });
    return { request: updated, bundle };
  });

  // ── Export download (GDPR Art. 20 zip/JSON) ──────────────────────────────────
  app.get<{ Params: { id: string } }>("/dsar/:id/export", async (request, reply) => {
    const actor = requireDsarProcessor(request, reply);
    if (!actor) return;
    const record = await getDsar(request.params.id);
    if (!record) return reply.code(404).send({ error: "Not found" });
    if (!canAccess(actor, record.tenantId)) return reply.code(403).send({ error: "Out of scope" });
    const bundle = await runExportFanout({
      subjectId: record.subjectId,
      subjectType: record.subjectType,
      tenantId: record.tenantId,
      subjectEmail: record.subjectEmail,
      dsarId: record.id,
    });
    reply.header("content-type", "application/json");
    reply.header("content-disposition", `attachment; filename="dsar-${record.id}-export.json"`);
    return bundle;
  });
}

function canAccess(
  actor: { actorRole: string | null; tenantId: string | null },
  recordTenantId: string | null,
): boolean {
  if (isPlatformAdmin(actor as any)) return true;
  if (isDistrictAdmin(actor as any))
    return recordTenantId !== null && recordTenantId === actor.tenantId;
  return false;
}
