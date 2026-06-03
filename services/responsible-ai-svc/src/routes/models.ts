/**
 * Model registry routes (Sprint 7).
 *   GET    /api/responsible-ai/models           list (filter status/modality/owner)
 *   POST   /api/responsible-ai/models           register (platform only)
 *   PATCH  /api/responsible-ai/models/:id        update (platform only)
 *   DELETE /api/responsible-ai/models/:id        retire (platform only)
 *   GET    /api/responsible-ai/models/:id/card   model card markdown + metadata
 */
import type { FastifyInstance } from "fastify";
import { getStore, newId } from "../registry/store.js";
import type { ModelRecord } from "../registry/types.js";
import { actorOf, canManageRegistry, deny } from "../registry/rbac.js";
import { emitRegistryAudit } from "../lib/registry-audit.js";

export function registerModelRoutes(app: FastifyInstance): void {
  const base = "/api/responsible-ai/models";

  app.get<{ Querystring: { status?: string; modality?: string; owner?: string } }>(
    base,
    async (request) => {
      const store = getStore();
      const { status, modality, owner } = request.query;
      let models = [...store.models.values()];
      if (status) models = models.filter((m) => m.status === status);
      if (modality) models = models.filter((m) => m.modality === modality);
      if (owner) models = models.filter((m) => m.owner.team.toLowerCase().includes(owner.toLowerCase()));
      return {
        models: models.map((m) => ({
          ...m,
          versions: [...store.versions.values()].filter((v) => v.modelId === m.id).length,
        })),
      };
    },
  );

  app.post<{ Body: Partial<ModelRecord> }>(base, async (request, reply) => {
    const actor = actorOf(request);
    if (!canManageRegistry(actor)) return deny(reply);
    const b = request.body ?? {};
    if (!b.name || !b.provider || !b.modality) {
      return reply.code(400).send({ error: "name, provider, modality are required" });
    }
    const store = getStore();
    const now = new Date().toISOString();
    const model: ModelRecord = {
      id: newId("model"),
      name: b.name,
      provider: b.provider,
      modality: b.modality,
      status: b.status ?? "draft",
      owner: b.owner ?? { team: "Unassigned", contact: "" },
      intendedUse: b.intendedUse ?? "",
      outOfScopeUse: b.outOfScopeUse ?? "",
      currentVersionId: null,
      createdAt: now,
      updatedAt: now,
    };
    store.models.set(model.id, model);
    await emitRegistryAudit(request, "RAI_MODEL_REGISTERED", model.id, { name: model.name });
    return reply.code(201).send({ model });
  });

  app.patch<{ Params: { id: string }; Body: Partial<ModelRecord> }>(
    `${base}/:id`,
    async (request, reply) => {
      const actor = actorOf(request);
      if (!canManageRegistry(actor)) return deny(reply);
      const store = getStore();
      const model = store.models.get(request.params.id);
      if (!model) return reply.code(404).send({ error: "Model not found" });
      const b = request.body ?? {};
      const updated: ModelRecord = {
        ...model,
        name: b.name ?? model.name,
        status: b.status ?? model.status,
        owner: b.owner ?? model.owner,
        intendedUse: b.intendedUse ?? model.intendedUse,
        outOfScopeUse: b.outOfScopeUse ?? model.outOfScopeUse,
        currentVersionId: b.currentVersionId ?? model.currentVersionId,
        updatedAt: new Date().toISOString(),
      };
      store.models.set(model.id, updated);
      await emitRegistryAudit(request, "RAI_MODEL_UPDATED", model.id, { changes: Object.keys(b) });
      return { model: updated };
    },
  );

  app.delete<{ Params: { id: string } }>(`${base}/:id`, async (request, reply) => {
    const actor = actorOf(request);
    if (!canManageRegistry(actor)) return deny(reply);
    const store = getStore();
    const model = store.models.get(request.params.id);
    if (!model) return reply.code(404).send({ error: "Model not found" });
    // Soft-delete: registry models are retired, never hard-deleted, so
    // audit/usage history stays intact.
    const retired = { ...model, status: "retired" as const, updatedAt: new Date().toISOString() };
    store.models.set(model.id, retired);
    await emitRegistryAudit(request, "RAI_MODEL_RETIRED", model.id, {});
    return { model: retired };
  });

  app.get<{ Params: { id: string } }>(`${base}/:id/card`, async (request, reply) => {
    const store = getStore();
    const model = store.models.get(request.params.id);
    if (!model) return reply.code(404).send({ error: "Model not found" });
    const card = store.cards.get(model.id);
    const versions = [...store.versions.values()]
      .filter((v) => v.modelId === model.id)
      .sort((a, b) => b.releasedAt.localeCompare(a.releasedAt));
    return { model, card: card ?? null, versions };
  });
}
