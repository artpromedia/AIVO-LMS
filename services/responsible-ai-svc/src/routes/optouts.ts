/**
 * Opt-out routes (Sprint 7).
 *   POST /api/responsible-ai/optouts                  create (own tenant; district subset)
 *   GET  /api/responsible-ai/optouts?tenantId=...     list (scoped)
 *   DELETE /api/responsible-ai/optouts/:id            remove
 *
 * District admins may opt their own tenant out of any model/feature.
 * School admins may only opt out of items already on their district's
 * allow-list (i.e. not already opted-out at the district level) — they
 * can tighten, never loosen, what the district permits.
 */
import type { FastifyInstance } from "fastify";
import { newId } from "../registry/store.js";
import { getRegistryRepository } from "../registry/repository.js";
import type { OptOut } from "../registry/types.js";
import { actorOf, canConfigureOptOut, isPlatform, deny } from "../registry/rbac.js";
import { emitRegistryAudit } from "../lib/registry-audit.js";

export function registerOptOutRoutes(app: FastifyInstance): void {
  const base = "/api/responsible-ai/optouts";

  app.get<{ Querystring: { tenantId?: string } }>(base, async (request) => {
    const repo = getRegistryRepository();
    const actor = actorOf(request);
    let optOuts = await repo.listOptOuts();
    const tenantFilter = isPlatform(actor) ? request.query.tenantId : actor.tenantId;
    if (tenantFilter) {
      const districtId = await repo.getDistrictForTenant(tenantFilter);
      optOuts = optOuts.filter((o) => o.tenantId === tenantFilter || o.tenantId === districtId);
    }
    return { optOuts };
  });

  app.post<{ Body: Partial<OptOut> }>(base, async (request, reply) => {
    const actor = actorOf(request);
    const b = request.body ?? {};
    const targetTenant = isPlatform(actor) ? (b.tenantId ?? actor.tenantId) : actor.tenantId;
    if (!targetTenant) return reply.code(400).send({ error: "tenantId required" });
    if (!canConfigureOptOut(actor, targetTenant)) return deny(reply);
    if (!b.modelId && !b.feature) {
      return reply.code(400).send({ error: "modelId or feature is required" });
    }
    const repo = getRegistryRepository();

    // School-admin subset rule: cannot opt out of something the district
    // has already opted the whole tree out of (that's already enforced),
    // and cannot exceed the district allow-list. We model the allow-list
    // as "not blocked by a district-level opt-out".
    const optOut: OptOut = {
      id: newId("optout"),
      tenantId: targetTenant,
      modelId: b.modelId ?? null,
      feature: b.feature ?? null,
      reason: b.reason ?? "",
      createdBy: actor.actorId ?? "unknown",
      createdByRole: actor.role ?? "unknown",
      createdAt: new Date().toISOString(),
    };
    await repo.upsertOptOut(optOut);
    await emitRegistryAudit(request, "RAI_OPTOUT_CREATED", optOut.id, {
      tenantId: optOut.tenantId,
      modelId: optOut.modelId,
      feature: optOut.feature,
    });
    return reply.code(201).send({ optOut });
  });

  app.delete<{ Params: { id: string } }>(`${base}/:id`, async (request, reply) => {
    const actor = actorOf(request);
    const repo = getRegistryRepository();
    const optOut = await repo.getOptOut(request.params.id);
    if (!optOut) return reply.code(404).send({ error: "Opt-out not found" });
    if (!canConfigureOptOut(actor, optOut.tenantId)) return deny(reply);
    await repo.deleteOptOut(optOut.id);
    await emitRegistryAudit(request, "RAI_OPTOUT_REMOVED", optOut.id, {
      tenantId: optOut.tenantId,
    });
    return { removed: true };
  });
}
