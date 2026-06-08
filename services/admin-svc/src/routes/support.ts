/**
 * Support ticket queue.
 *
 * Postgres-backed (support_tickets in @aivo/db), replacing the in-memory store
 * the legacy web-v2 admin used. Surfaced in the web-admin platform console.
 *
 *   GET   /api/admin-svc/support/tickets?status=   — list (newest first)
 *   POST  /api/admin-svc/support/tickets           — create
 *   PATCH /api/admin-svc/support/tickets/:id        — update status / assignee
 *
 * Visible to platform admins and the support role. Writes are hash-chained
 * into admin_audit_log.
 */
import { FastifyInstance } from "fastify";
import { and, desc, eq } from "drizzle-orm";
import { supportTickets, adminAuditLog, appendAudit } from "@aivo/db";
import { verifyJWT } from "@aivo/security";

const STATUSES = new Set(["open", "in_progress", "resolved"]);
const SUPPORT_ROLES = new Set(["PLATFORM_ADMIN", "SUPPORT"]);

async function requireSupportAgent(req: any, reply: any): Promise<boolean> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    reply.status(401).send({ error: "Missing authorization header" });
    return false;
  }
  try {
    const payload = await verifyJWT<any>(auth.slice(7));
    if (!SUPPORT_ROLES.has(payload.role as string)) {
      reply.status(403).send({ error: "Support or platform admin access required" });
      return false;
    }
    req.user = payload;
    return true;
  } catch {
    reply.status(401).send({ error: "Invalid token" });
    return false;
  }
}

function mapTicket(row: any) {
  return {
    id: row.id,
    tenantId: row.tenantId ?? null,
    userId: row.userId ?? null,
    subject: row.subject,
    body: row.body ?? "",
    status: row.status,
    assigneeId: row.assigneeId ?? null,
    createdAt: row.createdAt?.toISOString?.() ?? null,
    updatedAt: row.updatedAt?.toISOString?.() ?? null,
  };
}

async function audit(db: any, action: string, actor: any, ticket: any, details: Record<string, any>) {
  await appendAudit(db, "admin_audit_log", adminAuditLog, {
    action,
    actorId: actor.impersonatedBy || actor.sub,
    actorEmail: actor.email || "",
    actorRole: actor.role,
    onBehalfOfId: actor.impersonatedBy ? actor.sub : null,
    resourceType: "support_ticket",
    resourceId: ticket.id,
    details,
    ipAddress: null,
    userAgent: null,
    tenantId: actor.tenantId ?? null,
  });
}

export function registerSupportRoutes(app: FastifyInstance, db: any): void {
  app.get<{ Querystring: { status?: string } }>(
    "/api/admin-svc/support/tickets",
    { schema: { tags: ["support"], security: [{ bearerAuth: [] }] } },
    async (req, reply) => {
      if (!(await requireSupportAgent(req, reply))) return;
      const status = req.query.status;
      const where = status && STATUSES.has(status) ? eq(supportTickets.status, status) : undefined;
      const rows = await db
        .select()
        .from(supportTickets)
        .where(where ? and(where) : undefined)
        .orderBy(desc(supportTickets.createdAt));
      return { tickets: rows.map(mapTicket) };
    },
  );

  app.post<{
    Body: { subject?: string; body?: string; tenantId?: string | null; userId?: string | null };
  }>(
    "/api/admin-svc/support/tickets",
    { schema: { tags: ["support"], security: [{ bearerAuth: [] }] } },
    async (req, reply) => {
      if (!(await requireSupportAgent(req, reply))) return;
      const body = req.body ?? {};
      const subject = String(body.subject ?? "").trim();
      if (!subject) return reply.code(400).send({ error: "subject is required" });
      const [created] = await db
        .insert(supportTickets)
        .values({
          subject,
          body: String(body.body ?? ""),
          tenantId: body.tenantId ? String(body.tenantId) : null,
          userId: body.userId ? String(body.userId) : null,
          status: "open",
        })
        .returning();
      await audit(db, "support_ticket_created", (req as any).user, created, { subject });
      return reply.code(201).send({ ticket: mapTicket(created) });
    },
  );

  app.patch<{ Params: { id: string }; Body: { status?: string; assigneeId?: string | null } }>(
    "/api/admin-svc/support/tickets/:id",
    { schema: { tags: ["support"], security: [{ bearerAuth: [] }] } },
    async (req, reply) => {
      if (!(await requireSupportAgent(req, reply))) return;
      const { id } = req.params;
      const body = req.body ?? {};
      const patch: Record<string, unknown> = { updatedAt: new Date() };
      if (body.status !== undefined) {
        if (!STATUSES.has(String(body.status))) {
          return reply.code(400).send({ error: "status must be open|in_progress|resolved" });
        }
        patch.status = String(body.status);
      }
      if (body.assigneeId !== undefined) {
        patch.assigneeId = body.assigneeId ? String(body.assigneeId) : null;
      }
      const [updated] = await db
        .update(supportTickets)
        .set(patch)
        .where(eq(supportTickets.id, id))
        .returning();
      if (!updated) return reply.code(404).send({ error: "ticket_not_found" });
      await audit(db, "support_ticket_updated", (req as any).user, updated, { status: updated.status });
      return { ticket: mapTicket(updated) };
    },
  );
}
