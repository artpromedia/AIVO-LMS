import { FastifyInstance } from "fastify";
import { healthRootSchema, healthSchema } from "./schemas.js";

export function registerHealthRoutes(app: FastifyInstance) {
  const handler = async () => ({
    status: "ok",
    service: "status-page-svc",
    timestamp: new Date().toISOString(),
  });
  app.get("/health", { schema: healthRootSchema }, handler);
  app.get("/api/status/health", { schema: healthSchema }, handler);
}
