import type { FastifyInstance } from "fastify";
import {
  generateRecommendations,
  type GenerateCandidatesInput,
} from "../services/recommendation-generator.js";

export function registerCandidateRoutes(app: FastifyInstance): void {
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
      const recommendations = generateRecommendations(body);
      return { recommendations, tenantId };
    },
  );
}
