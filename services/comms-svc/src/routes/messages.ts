/**
 * Sprint 13 — message routes.
 *
 *   POST /api/comms/threads/:id/messages – author a message; on success
 *     dispatches a push fan-out to all participants via the PR #55
 *     push-router (stubbed today, real adapter when #55 merges).
 *   GET  /api/comms/threads/:id/messages – paginated read.
 *   POST /api/comms/messages/:id/read    – record a read receipt.
 *
 * Every state-mutating route emits an audit event.
 */
import type { FastifyInstance } from "fastify";
import { verifyJWT } from "@aivo/security";
import {
  messageThreads,
  messageThreadParticipants,
  messages,
  messageReadReceipts,
} from "@aivo/db";
import { and, desc, eq, isNull, lt } from "drizzle-orm";
import { booleanFromEnv, ENTERPRISE_FLAG_ENV_VARS } from "@aivo/feature-flags";
import {
  canPostToThread,
  canViewThread,
  type MessageThreadRow,
  type PolicyActor,
  type ThreadKind,
} from "../policy/visibility.js";
import { buildPolicyContext } from "../policy/context.js";
import { emitCommsAudit } from "../lib/audit.js";
import { routePush } from "../providers/push-router.js";

async function requireAuth(req: any, reply: any) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return reply.status(401).send({ error: "Missing authorization header" });
  }
  try {
    req.user = await verifyJWT(auth.slice(7));
  } catch {
    return reply.status(401).send({ error: "Invalid token" });
  }
}

function actorFromRequest(req: any): PolicyActor {
  const u = req.user ?? {};
  return {
    userId: String(u.sub ?? ""),
    tenantId: String(u.tenantId ?? req.headers["x-active-tenant"] ?? ""),
    role: String(u.role ?? "").toLowerCase(),
  };
}

function rowToThread(r: any): MessageThreadRow {
  return {
    id: r.id,
    kind: r.kind as ThreadKind,
    tenantId: r.tenantId,
    learnerId: r.learnerId ?? null,
    lessonId: r.lessonId ?? null,
    createdBy: r.createdBy,
    archivedAt: r.archivedAt ?? null,
  };
}

function flagEnabled(): boolean {
  return booleanFromEnv(ENTERPRISE_FLAG_ENV_VARS.messaging, false);
}

export function registerMessageRoutes(app: FastifyInstance, db: any) {
  app.addHook("preHandler", async (req, reply) => {
    if (
      !req.url.startsWith("/api/comms/threads/") &&
      !req.url.startsWith("/api/comms/messages/")
    ) {
      return;
    }
    if (req.url.includes("/messages")) {
      if (!flagEnabled()) reply.code(404).send({ error: "messaging_disabled" });
    }
  });

  // POST /api/comms/threads/:id/messages
  app.post(
    "/api/comms/threads/:id/messages",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = (request.body ?? {}) as { body?: string; bodyFormat?: "plain" | "markdown" };
      if (!body.body || typeof body.body !== "string") {
        return reply.code(400).send({ error: "body_required" });
      }
      const actor = actorFromRequest(request);
      const [threadRow] = await db
        .select()
        .from(messageThreads)
        .where(eq(messageThreads.id, id))
        .limit(1);
      if (!threadRow) return reply.code(404).send({ error: "not_found" });
      const ctx = buildPolicyContext(db);
      const decision = await canPostToThread(actor, rowToThread(threadRow), ctx);
      if (!decision.allowed) {
        await emitCommsAudit({
          db,
          request,
          eventType: "NOTIFICATION_FAILED",
          tenantId: actor.tenantId,
          resourceId: id,
          details: { op: "message_post_denied", reason: decision.reason },
        });
        return reply.code(403).send({ error: "forbidden", reason: decision.reason });
      }

      const [msg] = await db
        .insert(messages)
        .values({
          threadId: id,
          authorId: actor.userId,
          body: body.body,
          bodyFormat: body.bodyFormat ?? "plain",
        })
        .returning();

      // Bump thread updated_at so the inbox view can sort by recent.
      await db
        .update(messageThreads)
        .set({ updatedAt: new Date() })
        .where(eq(messageThreads.id, id));

      await emitCommsAudit({
        db,
        request,
        eventType: "NOTIFICATION_SENT",
        tenantId: actor.tenantId,
        resourceId: msg.id,
        learnerId: threadRow.learnerId,
        details: { op: "message_posted", threadId: id, kind: threadRow.kind },
      });

      // Push fan-out: notify every other participant. Returns 'skipped'
      // when no provider is configured (e.g. PR #55 not merged).
      const participants = await db
        .select({ userId: messageThreadParticipants.userId })
        .from(messageThreadParticipants)
        .where(
          and(
            eq(messageThreadParticipants.threadId, id),
            isNull(messageThreadParticipants.leftAt),
          ),
        );
      const pushResults: any[] = [];
      for (const p of participants) {
        if (p.userId === actor.userId) continue;
        const result = await routePush({
          userId: p.userId,
          title: "New message",
          body: body.body.slice(0, 140),
          collapseKey: `thread:${id}`,
          data: { threadId: id, messageId: msg.id },
        });
        pushResults.push({ userId: p.userId, ...result });
      }

      return reply.code(201).send({ message: msg, push: pushResults });
    },
  );

  // GET /api/comms/threads/:id/messages
  app.get(
    "/api/comms/threads/:id/messages",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const actor = actorFromRequest(request);
      const q = (request.query ?? {}) as { before?: string; limit?: string };

      const [threadRow] = await db
        .select()
        .from(messageThreads)
        .where(eq(messageThreads.id, id))
        .limit(1);
      if (!threadRow) return reply.code(404).send({ error: "not_found" });
      const ctx = buildPolicyContext(db);
      const decision = await canViewThread(actor, rowToThread(threadRow), ctx);
      if (!decision.allowed) {
        return reply.code(403).send({ error: "forbidden", reason: decision.reason });
      }

      const limit = Math.min(parseInt(q.limit ?? "50", 10) || 50, 200);
      const where = [eq(messages.threadId, id)];
      if (q.before) {
        const beforeDate = new Date(q.before);
        if (!Number.isNaN(beforeDate.getTime())) {
          where.push(lt(messages.createdAt, beforeDate));
        }
      }
      const rows = await db
        .select()
        .from(messages)
        .where(and(...where))
        .orderBy(desc(messages.createdAt))
        .limit(limit);
      return reply.send({ messages: rows });
    },
  );

  // POST /api/comms/messages/:id/read
  app.post(
    "/api/comms/messages/:id/read",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const actor = actorFromRequest(request);
      const [msg] = await db.select().from(messages).where(eq(messages.id, id)).limit(1);
      if (!msg) return reply.code(404).send({ error: "not_found" });
      const [threadRow] = await db
        .select()
        .from(messageThreads)
        .where(eq(messageThreads.id, msg.threadId))
        .limit(1);
      if (!threadRow) return reply.code(404).send({ error: "thread_not_found" });
      const ctx = buildPolicyContext(db);
      const decision = await canViewThread(actor, rowToThread(threadRow), ctx);
      if (!decision.allowed) {
        return reply.code(403).send({ error: "forbidden", reason: decision.reason });
      }
      await db
        .insert(messageReadReceipts)
        .values({ messageId: id, userId: actor.userId })
        .onConflictDoNothing();
      await emitCommsAudit({
        db,
        request,
        eventType: "NOTIFICATION_QUEUED",
        tenantId: actor.tenantId,
        resourceId: id,
        details: { op: "message_read" },
      });
      return reply.send({ status: "ok" });
    },
  );
}
