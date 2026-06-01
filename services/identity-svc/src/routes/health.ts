import { FastifyInstance } from "fastify";
import { composeHealth } from "@aivo/observability";
import { sql } from "drizzle-orm";

/**
 * Sprint 12.7 — health endpoint uses the shared composeHealth helper.
 * Identity-svc's only health gate is the database (no upstream HTTP
 * dependency blocks user logins). 503 is returned when any check fails
 * so load balancers can drain the bad replica.
 */
export async function registerHealthRoutes(app: FastifyInstance) {
  const handler = async (_req: any, reply: any) => {
    const db = (app as any).db;
    const dbCheck = db
      ? async () => {
          const started = Date.now();
          try {
            await db.execute(sql`SELECT 1`);
            return { ok: true as const, latencyMs: Date.now() - started };
          } catch (err: any) {
            return {
              ok: false as const,
              latencyMs: Date.now() - started,
              error: err?.message ?? String(err),
            };
          }
        }
      : undefined;
    const result = await composeHealth({
      service: "identity-svc",
      db: dbCheck,
    });
    reply.code(result.status === "healthy" ? 200 : 503).send(result);
  };
  app.get("/health", handler);
  app.get("/healthz", handler);
  app.get("/api/auth/health", handler);
}
