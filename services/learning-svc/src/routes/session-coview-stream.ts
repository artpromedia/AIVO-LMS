/**
 * GET /api/learning/sessions/:learnerId/stream — SSE for parent co-view.
 *
 * A parent on web (or mobile in the foreground) holds this stream open while
 * watching their child's active stage session. Every time learning-svc
 * inserts/updates a `lessonSessions` row for that learner, the parent gets
 * a push, across replicas (via NATS when configured; in-process
 * EventEmitter otherwise).
 *
 * Security mirrors the JSON `/api/learning/sessions?learnerId=…` route:
 *   - `requireLearnerAccess` enforces JWT + tenant match + parent-on-own-kid
 *     (PLATFORM_ADMIN bypass; internal-service token bypass).
 *
 * Polling on `/api/learning/sessions?learnerId=…` remains the documented
 * fallback when the client cannot hold a stream open.
 */
import type { FastifyInstance } from "fastify";
import { requireLearnerAccess } from "../lib/tenant.js";
import { getRealtimeBus, subjects } from "../realtime/bus.js";

export function registerSessionCoviewStreamRoutes(app: FastifyInstance, db: any): void {
  app.get<{ Params: { learnerId: string } }>(
    "/api/learning/sessions/:learnerId/stream",
    async (request, reply) => {
      const { learnerId } = request.params;

      const access = await requireLearnerAccess(request, reply, db, learnerId);
      if (!access) return;

      reply.raw.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "x-accel-buffering": "no",
      });
      reply.raw.write(": ok\n\n");

      const bus = await getRealtimeBus();
      const unsubscribe = await bus.subscribe(subjects.sessionCoview(learnerId), (payload) => {
        try {
          reply.raw.write(`event: session\ndata: ${JSON.stringify(payload)}\n\n`);
        } catch {
          /* connection closed — cleanup runs */
        }
      });

      const heartbeat = setInterval(() => {
        try {
          reply.raw.write(`event: ping\ndata: ${Date.now()}\n\n`);
        } catch {
          /* swallow */
        }
      }, 25_000);

      const cleanup = () => {
        clearInterval(heartbeat);
        void unsubscribe();
        try {
          reply.raw.end();
        } catch {
          /* already ended */
        }
      };
      request.raw.on("close", cleanup);
      request.raw.on("error", cleanup);
    },
  );
}
