import type { FastifyInstance } from "fastify";

export function registerPolicyRoutes(app: FastifyInstance): void {
  app.get("/api/responsible-ai/policy", async () => ({
    version: "1.0.0",
    modes: ["warn", "block"],
    contexts: ["lesson", "homework", "chat", "baseline", "recommendation"],
  }));
}
