import { FastifyInstance } from "fastify";
import { healthSchema } from "./schemas.js";

export function registerHealthRoutes(app: FastifyInstance) {
  const handler = async () => ({
    status: "ok",
    service: "engagement-svc",
    timestamp: new Date().toISOString(),
  });

  app.get("/api/engagement/health", { schema: healthSchema }, handler);
  // Liveness/Readiness/Startup probes hit /health
  app.get("/health", { schema: healthSchema }, handler);
}
