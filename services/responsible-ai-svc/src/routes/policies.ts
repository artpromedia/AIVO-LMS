/**
 * Safety policy routes (Sprint 7).
 *   GET /api/responsible-ai/policies                       list
 *   PUT /api/responsible-ai/policies/:id                   upsert (platform only)
 *   GET /api/responsible-ai/policies/effective?tenantId&modelId&feature  computed policy
 */
import type { FastifyInstance } from "fastify";
import { getStore } from "../registry/store.js";
import type { PolicyRecord } from "../registry/types.js";
import { resolveEffectivePolicy } from "../registry/policy-resolution.js";
import { actorOf, canEditPolicies, deny } from "../registry/rbac.js";
import { emitRegistryAudit } from "../lib/registry-audit.js";

export function registerPolicyRegistryRoutes(app: FastifyInstance): void {
  const base = "/api/responsible-ai/policies";

  app.get(base, async () => {
    const store = getStore();
    return { policies: [...store.policies.values()] };
  });

  app.get<{ Querystring: { tenantId?: string; modelId?: string; feature?: string } }>(
    `${base}/effective`,
    async (request, reply) => {
      const { tenantId, modelId, feature } = request.query;
      if (!tenantId || !modelId) {
        return reply.code(400).send({ error: "tenantId and modelId are required" });
      }
      const store = getStore();
      return resolveEffectivePolicy(store, { tenantId, modelId, feature });
    },
  );

  app.put<{ Params: { id: string }; Body: Partial<PolicyRecord> }>(
    `${base}/:id`,
    async (request, reply) => {
      const actor = actorOf(request);
      if (!canEditPolicies(actor)) return deny(reply);
      const store = getStore();
      const existing = store.policies.get(request.params.id);
      const b = request.body ?? {};
      const now = new Date().toISOString();
      const policy: PolicyRecord = {
        id: request.params.id,
        name: b.name ?? existing?.name ?? request.params.id,
        scopeLevel: b.scopeLevel ?? existing?.scopeLevel ?? "platform",
        scopeId: b.scopeId ?? existing?.scopeId ?? null,
        contentSafety: b.contentSafety ?? existing?.contentSafety ?? {
          blockedCategories: [],
          maxSeverity: "low",
        },
        ageGating: b.ageGating ?? existing?.ageGating ?? { minAge: null, requireGuardianConsent: false },
        regionRestrictions:
          b.regionRestrictions ?? existing?.regionRestrictions ?? { allowedRegions: [], blockedRegions: [] },
        enabled: b.enabled ?? existing?.enabled ?? true,
        updatedAt: now,
        updatedBy: actor.actorId ?? "platform_admin",
      };
      store.policies.set(policy.id, policy);
      await emitRegistryAudit(request, "RAI_POLICY_UPDATED", policy.id, {
        scopeLevel: policy.scopeLevel,
        scopeId: policy.scopeId,
      });
      return { policy };
    },
  );
}
