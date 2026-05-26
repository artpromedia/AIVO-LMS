import { FastifyInstance } from "fastify";
import { composeHealth, pingHttp } from "@aivo/observability";

/**
 * Sprint 12.7 — comms-svc health includes a downstream Postmark probe
 * (HEAD on https://api.postmarkapp.com/server). Returns 503 when any
 * check fails so the LB can pull the bad replica out of rotation.
 */
export function registerHealthRoutes(app: FastifyInstance) {
  const handler = async (_req: any, reply: any) => {
    const downstream: Record<string, () => Promise<any>> = {};
    if (process.env.POSTMARK_API_TOKEN || process.env.OONRUMAIL_API_KEY) {
      downstream.postmark = () => pingHttp("https://api.postmarkapp.com/server");
    }
    const result = await composeHealth({ service: "comms-svc", downstream });
    reply.code(result.status === "healthy" ? 200 : 503).send(result);
  };
  app.get("/health", handler);
  app.get("/healthz", handler);
  app.get("/api/comms/health", handler);
}
