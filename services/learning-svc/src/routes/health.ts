import { FastifyInstance } from "fastify";
import { healthSchema, healthRootSchema } from "./schemas.js";

export function registerHealthRoutes(app: FastifyInstance) {
  const handler = async () => ({
    status: "ok",
    service: "learning-svc",
    timestamp: new Date().toISOString(),
  });
  app.get("/health", { schema: healthRootSchema }, handler);
  app.get("/api/learning/health", { schema: healthSchema }, handler);
}
