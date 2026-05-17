/**
 * Sprint 7 — internal endpoint admin-svc itself uses to fire its own jobs
 * out-of-band when the operator clicks "Run now" on the Background Jobs page.
 * Routes are scoped to `/internal/*` and protected by AIVO_INTERNAL_SECRET so
 * only admin-svc can call its peer services.
 */
import type { FastifyInstance } from "fastify";
import type { SafeCronHandle } from "@aivo/scheduling";
import { internalJobsByJobNameRunNowSchema } from "./schemas.js";

const INTERNAL_HEADER = "x-aivo-internal-secret";

export function registerAdminInternalJobRoutes(
  app: FastifyInstance,
  handles: Record<string, SafeCronHandle>,
) {
  const expected = process.env.AIVO_INTERNAL_SECRET ?? null;
  app.post<{ Params: { jobName: string } }>(
    "/internal/jobs/:jobName/run-now",
    { schema: internalJobsByJobNameRunNowSchema }, async (req, reply) => {
      if (expected) {
        const got = req.headers[INTERNAL_HEADER];
        if (got !== expected) {
          reply.code(401).send({ error: "internal_secret_required" });
          return;
        }
      }
      const handle = handles[req.params.jobName];
      if (!handle) {
        reply.code(404).send({ error: "unknown_job" });
        return;
      }
      const result = await handle.triggerOnce();
      return { ok: true, ran: result.ran, reason: result.reason ?? null };
    },
  );
}
