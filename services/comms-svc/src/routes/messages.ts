/**
 * Threaded messaging — the unified inbox backend for the `/messages` surface.
 *
 *   GET  /api/comms/threads                         → my threads + unread
 *   POST /api/comms/threads                         → start a thread
 *   GET  /api/comms/threads/:threadId/messages      → messages in a thread
 *   POST /api/comms/threads/:threadId/messages      → send a message
 *   POST /api/comms/threads/:threadId/read          → mark read
 *
 * All endpoints are JWT-authenticated, tenant-scoped, and participant-checked
 * (you only ever see threads you belong to). The `x-aivo-active-role` header
 * is enforced as a hint, never a grant (ADR 0020).
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { and, asc, desc, eq, gt, inArray, ne } from "drizzle-orm";
import { messageThreads, messageThreadParticipants, messages } from "@aivo/db";
import {
  verifyJWT,
  checkActiveRole,
  ACTIVE_ROLE_HEADER,
  FORBIDDEN_ROLE_CODE,
  ACTIVE_ROLE_SPOOFING_EVENT,
} from "@aivo/security";

async function requireAuth(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return reply.code(401).send({ error: "Unauthorized" });
  }
  let user;
  try {
    user = await verifyJWT(auth.slice(7));
  } catch {
    return reply.code(401).send({ error: "Invalid token" });
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
    return reply.code(403).send({ error: "Forbidden role", code: FORBIDDEN_ROLE_CODE });
  }
  (req as any).user = user;
}

export function registerMessageRoutes(app: FastifyInstance, db: any): void {
  async function myParticipation(threadId: string, userId: string) {
    const [p] = await db
      .select()
      .from(messageThreadParticipants)
      .where(
        and(
          eq(messageThreadParticipants.threadId, threadId),
          eq(messageThreadParticipants.userId, userId),
        ),
      )
      .limit(1);
    return p ?? null;
  }

  async function participantUserIds(threadId: string): Promise<string[]> {
    const rows = await db
      .select({ userId: messageThreadParticipants.userId })
      .from(messageThreadParticipants)
      .where(eq(messageThreadParticipants.threadId, threadId));
    return rows.map((r: any) => r.userId);
  }

  // --- list my threads ---------------------------------------------------
  app.get("/api/comms/threads", { preHandler: requireAuth }, async (req) => {
    const user = (req as any).user;
    const myParts = await db
      .select()
      .from(messageThreadParticipants)
      .where(eq(messageThreadParticipants.userId, user.sub));
    const threadIds = myParts.map((p: any) => p.threadId);
    if (threadIds.length === 0) return { threads: [] };

    const threads = await db
      .select()
      .from(messageThreads)
      .where(and(inArray(messageThreads.id, threadIds), eq(messageThreads.tenantId, user.tenantId)))
      .orderBy(desc(messageThreads.lastMessageAt));

    const lastReadByThread = new Map<string, Date | null>(
      myParts.map((p: any) => [p.threadId, p.lastReadAt ?? null]),
    );

    const out = [];
    for (const th of threads) {
      const [last] = await db
        .select()
        .from(messages)
        .where(eq(messages.threadId, th.id))
        .orderBy(desc(messages.createdAt))
        .limit(1);

      const lastRead = lastReadByThread.get(th.id) ?? null;
      const unreadConds = [eq(messages.threadId, th.id), ne(messages.senderUserId, user.sub)];
      if (lastRead) unreadConds.push(gt(messages.createdAt, lastRead));
      const unreadRows = await db
        .select({ id: messages.id })
        .from(messages)
        .where(and(...unreadConds));

      out.push({
        id: th.id,
        subject: th.subject,
        learnerId: th.learnerId ?? null,
        lastMessageAt: th.lastMessageAt,
        unread: unreadRows.length,
        participantUserIds: await participantUserIds(th.id),
        lastMessage: last
          ? { body: last.body, senderUserId: last.senderUserId, createdAt: last.createdAt }
          : null,
      });
    }
    return { threads: out };
  });

  // --- start a thread ----------------------------------------------------
  app.post("/api/comms/threads", { preHandler: requireAuth }, async (req, reply) => {
    const user = (req as any).user;
    const body = (req.body as any) || {};
    const subject = typeof body.subject === "string" ? body.subject.trim().slice(0, 200) : "";
    const participants: string[] = Array.isArray(body.participantUserIds)
      ? body.participantUserIds.filter((x: unknown) => typeof x === "string")
      : [];
    const firstBody = typeof body.body === "string" ? body.body.trim() : "";
    const learnerId = typeof body.learnerId === "string" ? body.learnerId : null;
    if (!subject || participants.length === 0) {
      return reply.code(400).send({ error: "subject and participantUserIds are required" });
    }

    const [thread] = await db
      .insert(messageThreads)
      .values({
        tenantId: user.tenantId,
        subject,
        createdByUserId: user.sub,
        learnerId,
      })
      .returning();

    const members = Array.from(new Set([user.sub, ...participants]));
    await db.insert(messageThreadParticipants).values(
      members.map((userId) => ({ threadId: thread.id, userId })),
    );

    let firstMessage = null;
    if (firstBody) {
      [firstMessage] = await db
        .insert(messages)
        .values({ threadId: thread.id, senderUserId: user.sub, body: firstBody })
        .returning();
      await db
        .update(messageThreads)
        .set({ lastMessageAt: new Date() })
        .where(eq(messageThreads.id, thread.id));
      // The creator has implicitly read their own message.
      await db
        .update(messageThreadParticipants)
        .set({ lastReadAt: new Date() })
        .where(
          and(
            eq(messageThreadParticipants.threadId, thread.id),
            eq(messageThreadParticipants.userId, user.sub),
          ),
        );
    }

    return reply.code(201).send({
      thread: {
        id: thread.id,
        subject: thread.subject,
        learnerId: thread.learnerId ?? null,
        participantUserIds: members,
      },
      message: firstMessage,
    });
  });

  // --- messages in a thread ---------------------------------------------
  app.get(
    "/api/comms/threads/:threadId/messages",
    { preHandler: requireAuth },
    async (req, reply) => {
      const user = (req as any).user;
      const { threadId } = req.params as { threadId: string };
      if (!(await myParticipation(threadId, user.sub))) {
        return reply.code(403).send({ error: "Forbidden" });
      }
      const rows = await db
        .select()
        .from(messages)
        .where(eq(messages.threadId, threadId))
        .orderBy(asc(messages.createdAt));
      return {
        threadId,
        participantUserIds: await participantUserIds(threadId),
        messages: rows.map((m: any) => ({
          id: m.id,
          senderUserId: m.senderUserId,
          body: m.body,
          createdAt: m.createdAt,
          mine: m.senderUserId === user.sub,
        })),
      };
    },
  );

  // --- send a message ----------------------------------------------------
  app.post(
    "/api/comms/threads/:threadId/messages",
    { preHandler: requireAuth },
    async (req, reply) => {
      const user = (req as any).user;
      const { threadId } = req.params as { threadId: string };
      const text = typeof (req.body as any)?.body === "string" ? (req.body as any).body.trim() : "";
      if (!text) return reply.code(400).send({ error: "body is required" });
      if (!(await myParticipation(threadId, user.sub))) {
        return reply.code(403).send({ error: "Forbidden" });
      }
      const [message] = await db
        .insert(messages)
        .values({ threadId, senderUserId: user.sub, body: text })
        .returning();
      await db
        .update(messageThreads)
        .set({ lastMessageAt: new Date() })
        .where(eq(messageThreads.id, threadId));
      await db
        .update(messageThreadParticipants)
        .set({ lastReadAt: new Date() })
        .where(
          and(
            eq(messageThreadParticipants.threadId, threadId),
            eq(messageThreadParticipants.userId, user.sub),
          ),
        );
      return reply.code(201).send({
        message: {
          id: message.id,
          senderUserId: message.senderUserId,
          body: message.body,
          createdAt: message.createdAt,
          mine: true,
        },
      });
    },
  );

  // --- mark read ---------------------------------------------------------
  app.post(
    "/api/comms/threads/:threadId/read",
    { preHandler: requireAuth },
    async (req, reply) => {
      const user = (req as any).user;
      const { threadId } = req.params as { threadId: string };
      if (!(await myParticipation(threadId, user.sub))) {
        return reply.code(403).send({ error: "Forbidden" });
      }
      await db
        .update(messageThreadParticipants)
        .set({ lastReadAt: new Date() })
        .where(
          and(
            eq(messageThreadParticipants.threadId, threadId),
            eq(messageThreadParticipants.userId, user.sub),
          ),
        );
      return { ok: true };
    },
  );
}
