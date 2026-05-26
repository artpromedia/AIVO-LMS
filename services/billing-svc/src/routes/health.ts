import { FastifyInstance } from "fastify";
import { composeHealth, pingHttp, exportMetrics } from "@aivo/observability";

/**
 * Sprint 12.7 — billing-svc health includes a downstream Stripe API
 * probe (HEAD on https://api.stripe.com). Returns 503 when any check
 * fails so the LB can drain the bad replica.
 */
export function registerHealthRoutes(app: FastifyInstance) {
  const handler = async (_req: any, reply: any) => {
    const downstream: Record<string, () => Promise<any>> = {};
    if (process.env.STRIPE_SECRET_KEY) {
      downstream.stripe = () => pingHttp("https://api.stripe.com/v1");
    }
    const result = await composeHealth({ service: "billing-svc", downstream });
    reply.code(result.status === "healthy" ? 200 : 503).send(result);
  };
  app.get("/health", handler);
  app.get("/healthz", handler);
  app.get("/api/billing/health", handler);

  // Prometheus scrape endpoint. `@aivo/observability` holds counters
  // in-process; multi-replica deployments scrape each replica
  // independently or front them via Prometheus federation.
  app.get("/metrics", { schema: { hide: true } }, async (_req, reply) => {
    reply.type("text/plain; version=0.0.4").send(exportMetrics());
  });
}
