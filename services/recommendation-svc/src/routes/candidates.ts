import type { FastifyInstance } from "fastify";
import {
  generateRecommendations,
  type GenerateCandidatesInput,
} from "../services/recommendation-generator.js";
import {
  buildRebaselineCandidate,
  buildUpwardDeliveryCandidates,
  dedupeAgainstPending,
} from "../services/progression-candidates.js";
import type { RecommendationStore } from "../services/recommendation-store.js";
import { defaultStore } from "./recommendations.js";

export interface CandidateRouteDeps {
  store?: RecommendationStore;
}

export function registerCandidateRoutes(app: FastifyInstance, deps: CandidateRouteDeps = {}): void {
  // Share the recommendations route's in-memory default when nothing is
  // wired (dev/tests) so a generated candidate is retrievable by the
  // accept/amend/decline routes; production injects a Postgres store.
  const store = deps.store ?? defaultStore;

  app.post<{ Body: GenerateCandidatesInput }>(
    "/api/recommendations/candidates",
    async (request, reply) => {
      const body = request.body;
      if (!body?.learnerId || !Array.isArray(body?.signals)) {
        return reply.code(400).send({ error: "learnerId and signals[] are required" });
      }
      // Tenant scope: every recommendation request runs in the caller's
      // tenant. The enterprise auth hook places tenantId on request.auth;
      // service-to-service callers (tutor-svc, learning-svc) forward the
      // learner's tenantId via the same path. If we see neither, refuse —
      // recommendation generation must never happen without a tenant.
      const tenantId = (request as any).auth?.tenantId ?? (body as any).tenantId ?? null;
      if (!tenantId) {
        return reply.code(400).send({ error: "tenantId is required (auth context or body)" });
      }
      // Static support candidates + dynamic progression candidates
      // (upward delivery-level change, rebaseline). Progression candidates
      // are deduped against existing PENDING recommendations so the
      // per-lesson signal stream cannot spam parents with duplicates.
      const rebaseline = buildRebaselineCandidate(body);
      const candidates = [
        ...generateRecommendations(body),
        ...buildUpwardDeliveryCandidates(body),
        ...(rebaseline ? [rebaseline] : []),
      ];
      const existing = await store.listByLearner(body.learnerId);
      const recommendations = dedupeAgainstPending(candidates, existing);
      // Persist so the accept/amend/decline routes can act on them and they
      // survive a restart / are visible across replicas.
      for (const rec of recommendations) {
        await store.create(rec);
      }
      return { recommendations, tenantId };
    },
  );
}
