import { FastifyInstance } from "fastify";
import { exportMetrics } from "@aivo/observability";
import { healthRootSchema, healthSchema } from "./schemas.js";

export function registerHealthRoutes(app: FastifyInstance) {
  const handler = async () => ({
    status: "ok",
    service: "billing-svc",
    timestamp: new Date().toISOString(),
  });
  app.get("/health", { schema: healthRootSchema }, handler);
  app.get("/api/billing/health", { schema: healthSchema }, handler);

  // Prometheus scrape endpoint. `@aivo/observability` holds counters
  // in-process; multi-replica deployments scrape each replica
  // independently or front them via Prometheus federation.
  app.get("/metrics", { schema: { hide: true } }, async (_req, reply) => {
    reply.type("text/plain; version=0.0.4").send(exportMetrics());
  });
}
