import { FastifyInstance } from "fastify";
import { composeHealth, pingDb } from "@aivo/observability";

/**
 * Sprint 12.7 — health endpoint uses the shared composeHealth helper.
 * Identity-svc's only health gate is the database (no upstream HTTP
 * dependency blocks user logins). 503 is returned when any check fails
 * so load balancers can drain the bad replica.
 */
export async function registerHealthRoutes(app: FastifyInstance) {
  const handler = async (_req: any, reply: any) => {
    const db = (app as any).db;
    const result = await composeHealth({
      service: "identity-svc",
      db: db ? () => pingDb(db) : undefined,
    });
    reply.code(result.status === "healthy" ? 200 : 503).send(result);
  };
  app.get("/health", handler);
  app.get("/healthz", handler);
  app.get("/api/auth/health", handler);
}
