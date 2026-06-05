import { FastifyInstance } from "fastify";
import { healthSchema } from "./schemas.js";

export function registerHealthRoutes(app: FastifyInstance) {
  const handler = async () => ({
    status: "ok",
    service: "i18n-svc",
    timestamp: new Date().toISOString(),
  });
  app.get("/api/i18n/health", { schema: healthSchema }, handler);
  // K8s probe aliases (chart default probe path is /health)
  app.get("/health", handler);
  app.get("/healthz", handler);
}
