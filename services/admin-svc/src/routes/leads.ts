import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { adminAuditLog, appendAudit, leadSubmissions } from "@aivo/db";
import { and, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { createLogger } from "@aivo/observability";
import { verifyJWT } from "@aivo/security";
import { adminSvcLeadsSchema, adminSvcNewsletterSchema } from "./schemas.js";
import { logAuditEvent } from "./audit.js";
import { type NormalizedLead, deliverLeadToCrm } from "../lib/crm-webhook.js";

const logger = createLogger("admin-svc:leads");

const IS_PROD = process.env.NODE_ENV === "production";

/** Lead lifecycle. */
export const LEAD_STATUSES = ["new", "contacted", "qualified", "pilot", "won", "lost"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

/** Allowed forward transitions. won/lost are terminal. */
export const LEAD_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  new: ["contacted", "lost"],
  contacted: ["qualified", "lost"],
  qualified: ["pilot", "won", "lost"],
  pilot: ["won", "lost"],
  won: [],
  lost: [],
};

const LEAD_ACCESS_ROLES = ["PLATFORM_ADMIN", "SALES"];

interface LeadJwt {
  sub: string;
  role: string;
  email?: string;
}

/** Guard: only PLATFORM_ADMIN / SALES may read or mutate leads. */
async function requireLeadAccess(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<LeadJwt | null> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    reply.code(401).send({ error: "missing_bearer_token" });
    return null;
  }
  try {
    const payload = (await verifyJWT(auth.slice(7).trim())) as LeadJwt;
    if (!LEAD_ACCESS_ROLES.includes(payload.role)) {
      reply.code(403).send({ error: "forbidden", required_role: "PLATFORM_ADMIN or SALES" });
      return null;
    }
    return payload;
  } catch {
    reply.code(401).send({ error: "invalid_token" });
    return null;
  }
}

function resolveCommsSvcUrl(): string {
  const v = process.env.COMMS_SVC_URL;
  if (v) return v;
  if (IS_PROD) throw new Error("admin-svc: COMMS_SVC_URL must be set in production");
  return "http://localhost:3010";
}

async function sendNewsletterConfirmation(email: string): Promise<void> {
  const commsSvcUrl = resolveCommsSvcUrl();
  const internalKey = process.env.INTERNAL_SERVICE_KEY || "aivo-internal-dev-key";
  try {
    await fetch(`${commsSvcUrl}/api/comms/internal/newsletter-confirm`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-internal-key": internalKey },
      body: JSON.stringify({ to: email }),
    });
  } catch (err) {
    // Fail-soft: subscription is already stored; email failure is non-fatal.
    logger.warn({ err: String(err), email }, "Newsletter confirmation email failed");
  }
}

/** Parse + clamp lead list query params (pure; unit-tested). */
export function parseLeadListQuery(query: {
  status?: string;
  page?: string;
  pageSize?: string;
  search?: string;
}): { page: number; pageSize: number; status?: LeadStatus; search?: string } {
  const rawPage = Number.parseInt(query.page ?? "", 10);
  const page = Number.isFinite(rawPage) ? Math.max(1, rawPage) : 1;
  const rawSize = Number.parseInt(query.pageSize ?? "", 10);
  const pageSize = Number.isFinite(rawSize) ? Math.min(Math.max(1, rawSize), 200) : 50;
  const status =
    query.status && (LEAD_STATUSES as readonly string[]).includes(query.status)
      ? (query.status as LeadStatus)
      : undefined;
  const search = query.search?.trim() ? query.search.trim() : undefined;
  return { page, pageSize, status, search };
}

/** Shared status/search filter for list + export. */
function leadWhere(status?: LeadStatus, search?: string) {
  const conditions = [];
  if (status) conditions.push(eq(leadSubmissions.status, status));
  if (search) {
    const term = `%${search}%`;
    conditions.push(
      or(
        ilike(leadSubmissions.name, term),
        ilike(leadSubmissions.email, term),
        ilike(leadSubmissions.company, term),
      ),
    );
  }
  return conditions.length > 0 ? and(...conditions) : undefined;
}

/** RFC 4180-style CSV field escaping (pure; unit-tested). */
export function csvEscape(v: unknown): string {
  const str = v == null ? "" : String(v);
  return /[",\n]/.test(str) ? `"${str.replaceAll('"', '""')}"` : str;
}

function normalizeLead(row: Record<string, unknown>): NormalizedLead {
  const s = (v: unknown): string | null => (v == null ? null : String(v));
  return {
    id: String(row.id),
    type: String(row.type),
    name: String(row.name),
    email: String(row.email),
    company: s(row.company),
    role: s(row.role),
    message: s(row.message),
    source: String(row.source ?? "website"),
    status: String(row.status ?? "new"),
    utmSource: s(row.utmSource),
    utmMedium: s(row.utmMedium),
    utmCampaign: s(row.utmCampaign),
    couponCode: s(row.couponCode),
    createdAt:
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : String(row.createdAt ?? new Date().toISOString()),
  };
}

export function registerLeadRoutes(app: FastifyInstance, db: any) {
  // Defense-in-depth: ensure the attribution/lifecycle columns exist even on a
  // dev DB that hasn't run the 0065 migration (mirrors billing-svc coupons).
  void Promise.all([
    db.execute(sql`ALTER TABLE lead_submissions ADD COLUMN IF NOT EXISTS grade_band varchar(50)`),
    db.execute(
      sql`ALTER TABLE lead_submissions ADD COLUMN IF NOT EXISTS interest_area varchar(100)`,
    ),
    db.execute(sql`ALTER TABLE lead_submissions ADD COLUMN IF NOT EXISTS utm_source varchar(120)`),
    db.execute(sql`ALTER TABLE lead_submissions ADD COLUMN IF NOT EXISTS utm_medium varchar(120)`),
    db.execute(
      sql`ALTER TABLE lead_submissions ADD COLUMN IF NOT EXISTS utm_campaign varchar(120)`,
    ),
    db.execute(sql`ALTER TABLE lead_submissions ADD COLUMN IF NOT EXISTS coupon_code varchar(64)`),
    db.execute(
      sql`ALTER TABLE lead_submissions ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now() NOT NULL`,
    ),
  ]).catch(() => {});

  app.post("/api/admin-svc/leads", { schema: adminSvcLeadsSchema }, async (request, reply) => {
    const body = request.body as {
      type?: string;
      name?: string;
      email?: string;
      company?: string;
      role?: string;
      message?: string;
      schoolSize?: string;
      gradeBand?: string;
      interestArea?: string;
      source?: string;
      utmSource?: string;
      utmMedium?: string;
      utmCampaign?: string;
      couponCode?: string;
    };

    if (!body.name || !body.email) {
      return reply.status(400).send({ error: "Name and email are required" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return reply.status(400).send({ error: "Invalid email address" });
    }

    const validTypes = ["contact", "demo", "waitlist", "newsletter"];
    const type = validTypes.includes(body.type || "") ? body.type! : "contact";

    const [submission] = await db
      .insert(leadSubmissions)
      .values({
        type,
        name: body.name,
        email: body.email,
        company: body.company || null,
        role: body.role || null,
        message: body.message || null,
        schoolSize: body.schoolSize || null,
        gradeBand: body.gradeBand || null,
        interestArea: body.interestArea || null,
        source: body.source || "website",
        utmSource: body.utmSource || null,
        utmMedium: body.utmMedium || null,
        utmCampaign: body.utmCampaign || null,
        couponCode: body.couponCode || null,
      })
      .returning();

    // Optional CRM handoff: fail-soft, never blocks the response.
    const outcome = await deliverLeadToCrm(normalizeLead(submission), logger);
    logger.info({ leadId: submission.id, type, crm: outcome }, "lead captured");

    return { success: true, id: submission.id };
  });

  // ── Lead management (PLATFORM_ADMIN / SALES) ───────────────────────────────

  app.get("/api/admin-svc/leads", async (request, reply) => {
    if (!(await requireLeadAccess(request, reply))) return;
    const { page, pageSize, status, search } = parseLeadListQuery(
      (request.query ?? {}) as Record<string, string | undefined>,
    );
    const offset = (page - 1) * pageSize;
    const where = leadWhere(status, search);

    const [totalRow] = await db.select({ count: count() }).from(leadSubmissions).where(where);
    const rows = await db
      .select()
      .from(leadSubmissions)
      .where(where)
      .orderBy(desc(leadSubmissions.createdAt))
      .limit(pageSize)
      .offset(offset);
    return { leads: rows, total: Number(totalRow.count), page, pageSize };
  });

  // Sprint 11 — audited CSV export with the same status/search filters as
  // the list endpoint. Streams up to 10k rows newest-first.
  app.get("/api/admin-svc/leads/export.csv", async (request, reply) => {
    const me = await requireLeadAccess(request, reply);
    if (!me) return;
    const { status, search } = parseLeadListQuery(
      (request.query ?? {}) as Record<string, string | undefined>,
    );
    const where = leadWhere(status, search);

    // Canonical 11-key writer profile (all keys, nulls explicit) so the
    // chain verifier can recompute this row — mirrors exportIdentityCollection.
    await appendAudit(db, "admin_audit_log", adminAuditLog, {
      action: "admin.data.exported",
      actorId: me.sub,
      actorEmail: me.email ?? null,
      actorRole: String(me.role ?? "UNKNOWN"),
      onBehalfOfId: null,
      resourceType: "leads",
      resourceId: null,
      tenantId: null,
      details: { filters: { status: status ?? null, search: search ?? null } },
      ipAddress: (request.headers["x-forwarded-for"] as string) || request.ip || null,
      userAgent: (request.headers["user-agent"] as string) || null,
    });

    const rows = await db
      .select()
      .from(leadSubmissions)
      .where(where)
      .orderBy(desc(leadSubmissions.createdAt))
      .limit(10_000);

    const header = ["id", "type", "name", "email", "company", "source", "status", "createdAt"];
    const csv = [
      header.join(","),
      ...rows.map((r: (typeof rows)[number]) =>
        [r.id, r.type, r.name, r.email, r.company, r.source, r.status, r.createdAt?.toISOString?.() ?? r.createdAt]
          .map(csvEscape)
          .join(","),
      ),
    ].join("\n");

    reply
      .header("content-type", "text/csv; charset=utf-8")
      .header("content-disposition", 'attachment; filename="leads.csv"')
      .send(csv);
  });

  app.get("/api/admin-svc/leads/:id", async (request, reply) => {
    if (!(await requireLeadAccess(request, reply))) return;
    const { id } = request.params as { id: string };
    const [lead] = await db
      .select()
      .from(leadSubmissions)
      .where(eq(leadSubmissions.id, id))
      .limit(1);
    if (!lead) return reply.status(404).send({ error: "not_found" });
    return { lead };
  });

  app.patch("/api/admin-svc/leads/:id/status", async (request, reply) => {
    const me = await requireLeadAccess(request, reply);
    if (!me) return;
    const { id } = request.params as { id: string };
    const next = String((request.body as { status?: string })?.status ?? "");
    if (!(LEAD_STATUSES as readonly string[]).includes(next)) {
      return reply.status(400).send({ error: "invalid_status", allowed: LEAD_STATUSES });
    }

    const [lead] = await db
      .select()
      .from(leadSubmissions)
      .where(eq(leadSubmissions.id, id))
      .limit(1);
    if (!lead) return reply.status(404).send({ error: "not_found" });

    const from = lead.status as LeadStatus;
    if (from !== next) {
      const allowed = LEAD_TRANSITIONS[from] ?? [];
      if (!allowed.includes(next as LeadStatus)) {
        return reply.status(422).send({ error: "invalid_transition", from, to: next, allowed });
      }
    }

    await db
      .update(leadSubmissions)
      .set({ status: next, updatedAt: new Date() })
      .where(eq(leadSubmissions.id, id));

    await logAuditEvent(db, {
      action: "lead.status_changed",
      actorId: me.sub,
      actorEmail: me.email ?? "",
      actorRole: me.role,
      resourceType: "lead",
      resourceId: id,
      details: { from, to: next },
    });

    return { success: true, id, status: next };
  });

  app.post(
    "/api/admin-svc/newsletter",
    { schema: adminSvcNewsletterSchema },
    async (request, reply) => {
      const body = request.body as { email?: string };

      if (!body.email) {
        return reply.status(400).send({ error: "Email is required" });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(body.email)) {
        return reply.status(400).send({ error: "Invalid email address" });
      }

      const existing = await db
        .select({ id: leadSubmissions.id })
        .from(leadSubmissions)
        .where(eq(leadSubmissions.email, body.email))
        .limit(1);

      if (existing.length > 0) {
        return { success: true, message: "Already subscribed" };
      }

      const [submission] = await db
        .insert(leadSubmissions)
        .values({
          type: "newsletter",
          name: body.email.split("@")[0],
          email: body.email,
          source: "website",
        })
        .returning({ id: leadSubmissions.id });

      // Fire confirmation email via comms-svc (fail-soft).
      await sendNewsletterConfirmation(body.email);

      return { success: true, id: submission.id };
    },
  );
}
