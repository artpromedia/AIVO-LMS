import type { FastifyInstance } from "fastify";
import {
  decideRetentionForLearner,
  type RetentionPolicyConfig,
} from "../services/retention-policy.js";

export function registerRetentionRoutes(app: FastifyInstance): void {
  app.post<{ Body: RetentionPolicyConfig }>("/api/retention/decide", async (request, reply) => {
    const body = request.body;
    if (!body?.districtId) {
      return reply.code(400).send({ error: "districtId is required" });
    }
    return decideRetentionForLearner(body);
  });
}
