/**
 * GET /api/comms/threads/:threadId/stream — Server-Sent Events for the
 * messaging inbox. The browser opens this once per active thread and gets
 * push-fan-out of every new message landing on the thread, across replicas
 * (via the NATS-backed bus when `NATS_URL` is configured; in-process
 * EventEmitter otherwise).
 *
 * Security mirrors the JSON POST/GET routes on the same thread:
 *   - JWT bearer required
 *   - x-aivo-active-role enforced (ADR 0020, hint never grant)
 *   - participant check against `message_thread_participants`
 *   - tenant scoping comes for free via the participant check
 *
 * Polling on `/api/comms/threads/:id/messages` remains the documented
 * fallback when the client cannot hold an SSE connection open (corporate
 * proxies, flaky mobile networks). This route is additive — no JSON
 * behaviour changes.
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { and, eq } from "drizzle-orm";
import { messageThreadParticipants } from "@aivo/db";
import {
  verifyJWT,
  checkActiveRole,
  ACTIVE_ROLE_HEADER,
  FORBIDDEN_ROLE_CODE,
  ACTIVE_ROLE_SPOOFING_EVENT,
} from "@aivo/security";
import { getRealtimeBus, subjects } from "../realtime/bus.js";

interface AuthedUser {
  sub: string;
  tenantId: string;
  role: string;
}

async function requireAuth(req: FastifyRequest, reply: FastifyReply): Promise<AuthedUser | null> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    reply.code(401).send({ error: "Unauthorized" });
    return null;
  }
  let user: AuthedUser;
  try {
    user = (await verifyJWT(auth.slice(7))) as AuthedUser;
  } catch {
    reply.code(401).send({ error: "Invalid token" });
    return null;
  }
  const activeRole = checkActiveRole(user.role, req.headers[ACTIVE_ROLE_HEADER]);
  if (!activeRole.ok) {
    req.log?.warn?.(
      {
        event: ACTIVE_ROLE_SPOOFING_EVENT,
        userId: user.sub,
        tenantId: user.tenantId,
        requested: activeRole.requested,
        granted: activeRole.granted,
      },
      "rejected x-aivo-active-role header (token does not grant the requested role)",
    );
    reply.code(403).send({ error: "Forbidden role", code: FORBIDDEN_ROLE_CODE });
    return null;
  }
  return user;
}

export function registerInboxStreamRoutes(app: FastifyInstance, db: any): void {
  app.get<{ Params: { threadId: string } }>(
    "/api/comms/threads/:threadId/stream",
    async (req, reply) => {
      const user = await requireAuth(req, reply);
      if (!user) return;
      const { threadId } = req.params;

      // Participant check — only thread members may subscribe. Doubles as
      // tenant scoping because participants are inserted with the thread's
      // tenant on creation.
      const [participation] = await db
        .select()
        .from(messageThreadParticipants)
        .where(
          and(
            eq(messageThreadParticipants.threadId, threadId),
            eq(messageThreadParticipants.userId, user.sub),
          ),
        )
        .limit(1);
      if (!participation) {
        return reply.code(403).send({ error: "Forbidden" });
      }

      // Switch to a raw text/event-stream response. Once we touch
      // reply.raw, Fastify steps out of the way.
      reply.raw.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        // Disable proxy buffering (nginx, etc.) so events flush immediately.
        "x-accel-buffering": "no",
      });
      // Initial comment line keeps some intermediaries from buffering.
      reply.raw.write(": ok\n\n");

      const bus = await getRealtimeBus();
      const unsubscribe = await bus.subscribe(subjects.inboxThread(threadId), (payload) => {
        try {
          reply.raw.write(`event: message\ndata: ${JSON.stringify(payload)}\n\n`);
        } catch {
          /* connection closed mid-write — cleanup handler below will run */
        }
      });

      // Heartbeat every 25s — both keeps idle proxies happy AND gives the
      // client a signal to detect a half-open socket.
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
      req.raw.on("close", cleanup);
      req.raw.on("error", cleanup);
    },
  );
}
