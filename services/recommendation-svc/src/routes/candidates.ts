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
      const recommendations = generateRecommendations(body);
      return { recommendations };
    },
  );
}
