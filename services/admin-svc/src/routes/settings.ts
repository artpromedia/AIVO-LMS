/**
 * Platform settings: email delivery + webhooks.
 *
 * Reads the real Postgres tables (@aivo/db): `email_outbox` (transactional
 * email delivery) and `webhooks` / `webhook_deliveries`. Replaces the in-memory
 * placeholders the legacy web-v2 admin used. Secrets and message bodies are
 * never returned — only delivery metadata.
 *
 *   GET   /api/admin-svc/settings/emails?status=    — counts + recent
 *   POST  /api/admin-svc/settings/emails/:id/retry   — requeue a failed email
 *   GET   /api/admin-svc/settings/webhooks           — endpoints + recent deliveries
 *   PATCH /api/admin-svc/settings/webhooks/:id        — toggle active
 *
 * Platform admin only. Writes are hash-chained into admin_audit_log.
 */
import { FastifyInstance } from "fastify";
import { desc, eq, sql } from "drizzle-orm";
import { emailOutbox, webhooks, webhookDeliveries, adminAuditLog, appendAudit } from "@aivo/db";
import { verifyJWT } from "@aivo/security";

const EMAIL_STATUSES = new Set(["pending", "sent", "failed"]);

async function requirePlatformAdmin(req: any, reply: any): Promise<boolean> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    reply.status(401).send({ error: "Missing authorization header" });
    return false;
  }
  try {
    const payload = await verifyJWT<any>(auth.slice(7));
    if (payload.role !== "PLATFORM_ADMIN") {
      reply.status(403).send({ error: "Platform admin access required" });
      return false;
    }
    req.user = payload;
    return true;
  } catch {
    reply.status(401).send({ error: "Invalid token" });
    return false;
  }
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const iso = (v: any): string | null => v?.toISOString?.() ?? (v ? String(v) : null);

function countsFrom(rows: Array<{ key: unknown; n: unknown }>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of rows) out[String(row.key)] = num(row.n);
  return out;
}

function mapEmail(r: any) {
  return {
    id: r.id,
    toEmail: r.toEmail,
    subject: r.subject ?? null,
    sendKind: r.sendKind,
    templateAlias: r.templateAlias ?? null,
    tag: r.tag ?? null,
    status: r.status,
    attempt: num(r.attempt),
    maxAttempts: num(r.maxAttempts),
    lastError: r.lastError ?? null,
    providerMessageId: r.providerMessageId ?? null,
    tenantId: r.tenantId ?? null,
    createdAt: iso(r.createdAt),
    sentAt: iso(r.sentAt),
    failedAt: iso(r.failedAt),
    nextRetryAt: iso(r.nextRetryAt),
  };
}

function mapWebhook(r: any) {
  return {
    id: r.id,
    url: r.url,
    events: Array.isArray(r.events) ? r.events.map(String) : [],
    active: Boolean(r.active),
    tenantId: r.tenantId ?? null,
    lastDeliveryAt: iso(r.lastDeliveryAt),
    lastDeliveryStatus: r.lastDeliveryStatus ?? null,
    createdAt: iso(r.createdAt),
  };
}

async function audit(db: any, action: string, actor: any, resource: any, details: Record<string, any>) {
  await appendAudit(db, "admin_audit_log", adminAuditLog, {
    action,
    actorId: actor.impersonatedBy || actor.sub,
    actorEmail: actor.email || "",
    actorRole: actor.role,
    onBehalfOfId: actor.impersonatedBy ? actor.sub : null,
    resourceType: action.startsWith("webhook") ? "webhook" : "email_outbox",
    resourceId: resource.id,
    details,
    ipAddress: null,
    userAgent: null,
    tenantId: actor.tenantId ?? null,
  });
}

export function registerSettingsRoutes(app: FastifyInstance, db: any): void {
  // ── Emails ─────────────────────────────────────────────────────────────
  app.get<{ Querystring: { status?: string } }>(
    "/api/admin-svc/settings/emails",
    { schema: { tags: ["settings"], security: [{ bearerAuth: [] }] } },
    async (req, reply) => {
      if (!(await requirePlatformAdmin(req, reply))) return;
      const status = req.query.status;
      const where = status && EMAIL_STATUSES.has(status) ? eq(emailOutbox.status, status) : undefined;

      const countRows = await db
        .select({ key: emailOutbox.status, n: sql<number>`count(*)` })
        .from(emailOutbox)
        .groupBy(emailOutbox.status);

      const rows = await db
        .select()
        .from(emailOutbox)
        .where(where)
        .orderBy(desc(emailOutbox.createdAt))
        .limit(100);

      return { counts: countsFrom(countRows), emails: rows.map(mapEmail) };
    },
  );

  app.post<{ Params: { id: string } }>(
    "/api/admin-svc/settings/emails/:id/retry",
    { schema: { tags: ["settings"], security: [{ bearerAuth: [] }] } },
    async (req, reply) => {
      if (!(await requirePlatformAdmin(req, reply))) return;
      const [existing] = await db
        .select()
        .from(emailOutbox)
        .where(eq(emailOutbox.id, req.params.id))
        .limit(1);
      if (!existing) return reply.code(404).send({ error: "email_not_found" });
      if (existing.status !== "failed") {
        return reply.code(400).send({ error: "only failed emails can be retried" });
      }
      const [updated] = await db
        .update(emailOutbox)
        .set({ status: "pending", nextRetryAt: new Date(), lastError: null, updatedAt: new Date() })
        .where(eq(emailOutbox.id, req.params.id))
        .returning();
      await audit(db, "email_retried", (req as any).user, updated, { toEmail: updated.toEmail });
      return { email: mapEmail(updated) };
    },
  );

  // ── Webhooks ───────────────────────────────────────────────────────────
  app.get(
    "/api/admin-svc/settings/webhooks",
    { schema: { tags: ["settings"], security: [{ bearerAuth: [] }] } },
    async (req, reply) => {
      if (!(await requirePlatformAdmin(req, reply))) return;
      const hooks = await db.select().from(webhooks).orderBy(desc(webhooks.createdAt)).limit(200);
      const deliveries = await db
        .select({
          id: webhookDeliveries.id,
          webhookId: webhookDeliveries.webhookId,
          event: webhookDeliveries.event,
          responseStatus: webhookDeliveries.responseStatus,
          deliveredAt: webhookDeliveries.deliveredAt,
        })
        .from(webhookDeliveries)
        .orderBy(desc(webhookDeliveries.deliveredAt))
        .limit(100);
      return {
        webhooks: hooks.map(mapWebhook),
        deliveries: deliveries.map((d: any) => ({
          id: d.id,
          webhookId: d.webhookId,
          event: d.event,
          responseStatus: d.responseStatus ?? null,
          deliveredAt: iso(d.deliveredAt),
        })),
      };
    },
  );

  app.patch<{ Params: { id: string }; Body: { active?: boolean } }>(
    "/api/admin-svc/settings/webhooks/:id",
    { schema: { tags: ["settings"], security: [{ bearerAuth: [] }] } },
    async (req, reply) => {
      if (!(await requirePlatformAdmin(req, reply))) return;
      const active = Boolean(req.body?.active);
      const [updated] = await db
        .update(webhooks)
        .set({ active })
        .where(eq(webhooks.id, req.params.id))
        .returning();
      if (!updated) return reply.code(404).send({ error: "webhook_not_found" });
      await audit(db, "webhook_updated", (req as any).user, updated, { active });
      return { webhook: mapWebhook(updated) };
    },
  );
}
