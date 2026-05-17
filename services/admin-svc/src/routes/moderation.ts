import { FastifyInstance } from "fastify";
import { contentModerationLog } from "@aivo/db";
import { verifyJWT } from "@aivo/security";
import { sql, eq, and, desc, count, gte, lte } from "drizzle-orm";
import { adminSvcInternalModerationSchema, getAdminSvcModerationSchema, getAdminSvcModerationByIdSchema, patchAdminSvcModerationByIdSchema, getAdminSvcModerationStatsSchema } from "./schemas.js";

const INTERNAL_KEY =
  process.env.INTERNAL_SERVICE_KEY ||
  (process.env.NODE_ENV === "production" ? "" : "aivo-internal-dev-key");

async function requirePlatformAdmin(req: any, reply: any) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return reply.status(401).send({ error: "Missing authorization header" });
  }
  try {
    const payload = await verifyJWT(auth.slice(7));
    if (payload.role !== "PLATFORM_ADMIN") {
      return reply.status(403).send({ error: "Platform admin access required" });
    }
    req.user = payload;
  } catch {
    return reply.status(401).send({ error: "Invalid token" });
  }
}

async function requireInternalKey(req: any, reply: any) {
  const key = req.headers["x-internal-key"];
  if (!INTERNAL_KEY || key !== INTERNAL_KEY) {
    return reply.status(401).send({ error: "Unauthorized" });
  }
}

export function registerModerationRoutes(app: FastifyInstance, db: any) {
  // Internal: AI service posts flagged content here.
  app.post("/api/admin-svc/internal/moderation", { schema: adminSvcInternalModerationSchema, preHandler: requireInternalKey }, async (request, reply) => {
    const body = request.body as any;
    if (!body?.content || !body?.flagReason || !body?.contentType) {
      return reply.code(400).send({ error: "content, flagReason, contentType required" });
    }
    const [row] = await db.insert(contentModerationLog).values({
      tenantId: body.tenantId || null,
      learnerId: body.learnerId || null,
      sessionId: body.sessionId || null,
      contentType: body.contentType,
      content: String(body.content).slice(0, 8000),
      flagReason: body.flagReason,
      flagConfidence: body.flagConfidence != null ? String(body.flagConfidence) : null,
      gateResults: body.gateResults || null,
      tutorSku: body.tutorSku || null,
      modelUsed: body.modelUsed || null,
      status: body.status || "PENDING",
    }).returning({ id: contentModerationLog.id });
    return { id: row.id, status: "logged" };
  });

  // List with filters + pagination
  app.get("/api/admin-svc/moderation", { schema: getAdminSvcModerationSchema, preHandler: requirePlatformAdmin }, async (request) => {
    const q = request.query as any;
    const page = Math.max(1, parseInt(q.page || "1", 10));
    const perPage = Math.min(200, Math.max(1, parseInt(q.perPage || "25", 10)));
    const offset = (page - 1) * perPage;

    const conds: any[] = [];
    if (q.status) conds.push(eq(contentModerationLog.status, q.status));
    if (q.contentType) conds.push(eq(contentModerationLog.contentType, q.contentType));
    if (q.tutorSku) conds.push(eq(contentModerationLog.tutorSku, q.tutorSku));
    if (q.tenantId) conds.push(eq(contentModerationLog.tenantId, q.tenantId));
    if (q.from) conds.push(gte(contentModerationLog.createdAt, new Date(q.from)));
    if (q.to) conds.push(lte(contentModerationLog.createdAt, new Date(q.to)));
    const whereExpr = conds.length ? and(...conds) : undefined;

    const rowsQuery = db.select().from(contentModerationLog);
    if (whereExpr) rowsQuery.where(whereExpr);
    const rows = await rowsQuery.orderBy(desc(contentModerationLog.createdAt)).limit(perPage).offset(offset);

    const totalQuery = db.select({ c: count() }).from(contentModerationLog);
    if (whereExpr) totalQuery.where(whereExpr);
    const [{ c: total }] = await totalQuery;

    return { items: rows, page, perPage, total };
  });

  // Single record
  app.get("/api/admin-svc/moderation/:id", { schema: getAdminSvcModerationByIdSchema, preHandler: requirePlatformAdmin }, async (request, reply) => {
    const { id } = request.params as any;
    const [row] = await db.select().from(contentModerationLog).where(eq(contentModerationLog.id, id)).limit(1);
    if (!row) return reply.code(404).send({ error: "Not found" });
    return row;
  });

  // Update status / review notes
  app.patch("/api/admin-svc/moderation/:id", { schema: patchAdminSvcModerationByIdSchema, preHandler: requirePlatformAdmin }, async (request, reply) => {
    const { id } = request.params as any;
    const { status, reviewNotes } = request.body as any;
    const allowed = ["APPROVED", "REJECTED", "ESCALATED", "PENDING"];
    if (status && !allowed.includes(status)) {
      return reply.code(400).send({ error: `status must be one of ${allowed.join(", ")}` });
    }
    const user = (request as any).user;
    const updates: any = { reviewedBy: user.sub, reviewedAt: new Date() };
    if (status) updates.status = status;
    if (reviewNotes !== undefined) updates.reviewNotes = reviewNotes;
    const [row] = await db.update(contentModerationLog)
      .set(updates)
      .where(eq(contentModerationLog.id, id))
      .returning();
    if (!row) return reply.code(404).send({ error: "Not found" });
    return row;
  });

  // Aggregate stats
  app.get("/api/admin-svc/moderation/stats", { schema: getAdminSvcModerationStatsSchema, preHandler: requirePlatformAdmin }, async () => {
    const byStatus = await db.execute(sql`
      SELECT status::text AS status, COUNT(*)::int AS count
      FROM content_moderation_log GROUP BY status
    `);
    const byReason = await db.execute(sql`
      SELECT flag_reason AS reason, COUNT(*)::int AS count
      FROM content_moderation_log GROUP BY flag_reason ORDER BY count DESC LIMIT 20
    `);
    const byTutor = await db.execute(sql`
      SELECT COALESCE(tutor_sku, 'unknown') AS tutor, COUNT(*)::int AS count
      FROM content_moderation_log GROUP BY tutor_sku ORDER BY count DESC LIMIT 20
    `);
    const rows = (r: any) => (Array.isArray(r) ? r : (r as any).rows ?? []);
    return {
      byStatus: rows(byStatus),
      byReason: rows(byReason),
      byTutor: rows(byTutor),
    };
  });
}
