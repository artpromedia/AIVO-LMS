import { FastifyInstance } from "fastify";
import { healthSchema, probeHealthSchema } from "./schemas.js";

export function registerHealthRoutes(app: FastifyInstance) {
  const handler = async () => ({
    status: "ok",
    service: "engagement-svc",
    timestamp: new Date().toISOString(),
  });

  app.get("/api/engagement/health", { schema: healthSchema }, handler);
  // Liveness/Readiness/Startup probes hit /health. Distinct schema so the
  // generated OpenAPI document has unique operationIds.
  app.get("/health", { schema: probeHealthSchema }, handler);
}
