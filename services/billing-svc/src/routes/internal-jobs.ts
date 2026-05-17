/**
 * Sprint 7 — internal endpoint admin-svc calls when an operator clicks
 * "Run now" on the Background Jobs page (Task #76). The endpoint is on a
 * service-internal port and doesn't require the PLATFORM_ADMIN JWT — admin-svc
 * vouches for the caller — but we *do* require an internal shared-secret
 * header so a bad-actor pod on the cluster can't poke us into spamming users.
 */
import type { FastifyInstance } from "fastify";
import type { SafeCronHandle } from "@aivo/scheduling";
import { runInternalJobSchema } from "./schemas.js";

const INTERNAL_HEADER = "x-aivo-internal-secret";

export function registerInternalJobRoutes(
  app: FastifyInstance,
  handles: Record<string, SafeCronHandle>,
) {
  const expected = process.env.AIVO_INTERNAL_SECRET ?? null;
  app.post<{ Params: { jobName: string } }>(
    "/internal/jobs/:jobName/run-now",
    { schema: runInternalJobSchema },
    async (req, reply) => {
      if (expected) {
        const got = req.headers[INTERNAL_HEADER];
        if (got !== expected) {
          reply.code(401).send({ error: "internal_secret_required" });
          return;
        }
      }
      const handle = handles[req.params.jobName];
      if (!handle) {
        reply.code(404).send({ error: "unknown_job", jobName: req.params.jobName });
        return;
      }
      const result = await handle.triggerOnce();
      return { ok: true, ran: result.ran, reason: result.reason ?? null };
    },
  );
}
