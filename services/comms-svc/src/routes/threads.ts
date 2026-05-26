/**
 * Sprint 13 — message thread routes.
 *
 * All state-mutating endpoints emit an audit event and gate behind the
 * `messaging` enterprise feature flag (default off).
 */
import type { FastifyInstance } from "fastify";
import { verifyJWT } from "@aivo/security";
import { messageThreads, messageThreadParticipants } from "@aivo/db";
import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { booleanFromEnv, ENTERPRISE_FLAG_ENV_VARS } from "@aivo/feature-flags";
import {
  canCreateThread,
  canViewThread,
  type MessageThreadRow,
  type PolicyActor,
  type ThreadKind,
} from "../policy/visibility.js";
import { buildPolicyContext } from "../policy/context.js";
import { emitCommsAudit } from "../lib/audit.js";

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

export function registerThreadRoutes(app: FastifyInstance, db: any) {
  app.addHook("preHandler", async (req, reply) => {
    if (!req.url.startsWith("/api/comms/threads")) return;
    if (!flagEnabled()) {
      reply.code(404).send({ error: "messaging_disabled" });
    }
  });

  // POST /api/comms/threads — create
  app.post("/api/comms/threads", { preHandler: requireAuth }, async (request, reply) => {
    const body = (request.body ?? {}) as {
      kind?: ThreadKind;
      learnerId?: string | null;
      lessonId?: string | null;
      participantIds?: string[];
    };
    const actor = actorFromRequest(request);
    if (!actor.userId || !actor.tenantId) {
      return reply.code(401).send({ error: "missing_identity" });
    }
    if (!body.kind) {
      return reply.code(400).send({ error: "kind_required" });
    }
    const ctx = buildPolicyContext(db);
    const decision = await canCreateThread(
      actor,
      body.kind,
      body.learnerId ?? null,
      body.lessonId ?? null,
      ctx,
    );
    if (!decision.allowed) {
      await emitCommsAudit({
        db,
        request,
        eventType: "NOTIFICATION_FAILED",
        tenantId: actor.tenantId,
        details: {
          op: "thread_create_denied",
          reason: decision.reason,
          kind: body.kind,
          learnerId: body.learnerId,
          lessonId: body.lessonId,
        },
      });
      return reply.code(403).send({ error: "forbidden", reason: decision.reason });
    }

    const [thread] = await db
      .insert(messageThreads)
      .values({
        kind: body.kind,
        tenantId: actor.tenantId,
        learnerId: body.learnerId ?? null,
        lessonId: body.lessonId ?? null,
        createdBy: actor.userId,
      })
      .returning();

    // Always add creator as an author. Additional participants are added
    // as readers (or observer for caregivers — left to a later sync job).
    const seedParticipants: any[] = [
      { threadId: thread.id, userId: actor.userId, role: "author" },
    ];
    const extras = Array.from(new Set((body.participantIds ?? []).filter((s) => typeof s === "string")));
    for (const uid of extras) {
      if (uid === actor.userId) continue;
      seedParticipants.push({ threadId: thread.id, userId: uid, role: "reader" });
    }
    if (seedParticipants.length > 0) {
      await db.insert(messageThreadParticipants).values(seedParticipants).onConflictDoNothing();
    }

    await emitCommsAudit({
      db,
      request,
      eventType: "NOTIFICATION_QUEUED",
      tenantId: actor.tenantId,
      resourceId: thread.id,
      learnerId: thread.learnerId,
      details: { op: "thread_created", kind: thread.kind },
    });
    return reply.code(201).send({ thread });
  });

  // GET /api/comms/threads — list visible
  app.get("/api/comms/threads", { preHandler: requireAuth }, async (request, reply) => {
    const actor = actorFromRequest(request);
    if (!actor.userId || !actor.tenantId) {
      return reply.code(401).send({ error: "missing_identity" });
    }
    const q = (request.query ?? {}) as {
      learnerId?: string;
      lessonId?: string;
      kind?: ThreadKind;
    };
    // Threads visible to actor = threads where actor is a participant
    // (joinedAt set, leftAt null). We post-filter through the policy so
    // anything that slipped in through stale participant rows is still
    // blocked.
    const participantRows = await db
      .select({ threadId: messageThreadParticipants.threadId })
      .from(messageThreadParticipants)
      .where(
        and(
          eq(messageThreadParticipants.userId, actor.userId),
          isNull(messageThreadParticipants.leftAt),
        ),
      );
    const threadIds = participantRows.map((r: any) => r.threadId);
    if (threadIds.length === 0) return reply.send({ threads: [] });

    const where = [eq(messageThreads.tenantId, actor.tenantId), inArray(messageThreads.id, threadIds)];
    if (q.kind) where.push(eq(messageThreads.kind, q.kind));
    if (q.learnerId) where.push(eq(messageThreads.learnerId, q.learnerId));
    if (q.lessonId) where.push(eq(messageThreads.lessonId, q.lessonId));

    const rows = await db
      .select()
      .from(messageThreads)
      .where(and(...where))
      .orderBy(desc(messageThreads.createdAt))
      .limit(100);

    const ctx = buildPolicyContext(db);
    const filtered: any[] = [];
    for (const r of rows) {
      const decision = await canViewThread(actor, rowToThread(r), ctx);
      if (decision.allowed) filtered.push(r);
    }
    return reply.send({ threads: filtered });
  });

  // GET /api/comms/threads/:id
  app.get(
    "/api/comms/threads/:id",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const actor = actorFromRequest(request);
      const [row] = await db.select().from(messageThreads).where(eq(messageThreads.id, id)).limit(1);
      if (!row) return reply.code(404).send({ error: "not_found" });
      const ctx = buildPolicyContext(db);
      const decision = await canViewThread(actor, rowToThread(row), ctx);
      if (!decision.allowed) {
        return reply.code(403).send({ error: "forbidden", reason: decision.reason });
      }
      return reply.send({ thread: row });
    },
  );

  // PATCH /api/comms/threads/:id — archive
  app.patch(
    "/api/comms/threads/:id",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const actor = actorFromRequest(request);
      const body = (request.body ?? {}) as { archive?: boolean };
      const [row] = await db.select().from(messageThreads).where(eq(messageThreads.id, id)).limit(1);
      if (!row) return reply.code(404).send({ error: "not_found" });
      const ctx = buildPolicyContext(db);
      const decision = await canViewThread(actor, rowToThread(row), ctx);
      if (!decision.allowed) {
        return reply.code(403).send({ error: "forbidden", reason: decision.reason });
      }
      const patch: any = { updatedAt: new Date() };
      if (body.archive === true) patch.archivedAt = new Date();
      if (body.archive === false) patch.archivedAt = null;
      const [updated] = await db
        .update(messageThreads)
        .set(patch)
        .where(eq(messageThreads.id, id))
        .returning();
      await emitCommsAudit({
        db,
        request,
        eventType: "NOTIFICATION_QUEUED",
        tenantId: actor.tenantId,
        resourceId: id,
        details: { op: "thread_patched", archive: body.archive === true },
      });
      return reply.send({ thread: updated });
    },
  );
}
