import type { FastifyInstance } from "fastify";
import {
  analyzeScienceReasoning,
  type ScienceAnalysisInput,
} from "../services/science-reasoning-analyzer.js";

export function registerAnalyzeRoutes(app: FastifyInstance): void {
  app.post<{ Body: ScienceAnalysisInput }>(
    "/api/science-solver/analyze",
    async (request, reply) => {
      const body = request.body;
      if (!body || !body.learnerId || !body.prompt || body.response === undefined) {
        return reply.code(400).send({ error: "learnerId, prompt, and response are required" });
      }
      return analyzeScienceReasoning(body);
    },
  );
}
