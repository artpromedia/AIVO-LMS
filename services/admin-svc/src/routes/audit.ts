import { FastifyInstance } from "fastify";
import { adminAuditLog, districtActivityLog, appendAudit } from "@aivo/db";
import { Permission } from "@aivo/security";
import { createReadDedupe } from "@aivo/audit-client";
import { eq, desc, asc, sql, and, gte, lte, or, count, ilike } from "drizzle-orm";
import { startCsv, EXPORT_ROW_CAP } from "../lib/csv.js";
import {
  getAdminSvcAuditLogSchema,
  getAdminSvcActivitySchema,
  postAdminSvcAuditLogReadEventsSchema,
} from "./schemas.js";
import { requirePermission } from "../lib/permissions.js";

export async function logAuditEvent(
  db: any,
  event: {
    action: string;
    actorId: string;
    actorEmail: string;
    actorRole: string;
    onBehalfOfId?: string | null;
    resourceType: string;
    resourceId?: string;
    details?: any;
    ipAddress?: string;
    userAgent?: string;
    tenantId?: string;
  },
) {
  // Sprint 4: route admin audit writes through the hash-chain helper so
  // every row gets prev_hash/hash. Without this, tamper evidence breaks
  // and the verifier reports the row as legacy (unhashed).
  await appendAudit(db, "admin_audit_log", adminAuditLog, {
    action: event.action,
    actorId: event.actorId,
    actorEmail: event.actorEmail,
    actorRole: event.actorRole,
    onBehalfOfId: event.onBehalfOfId ?? null,
    resourceType: event.resourceType,
    resourceId: event.resourceId ?? null,
    details: event.details ?? null,
    ipAddress: event.ipAddress ?? null,
    userAgent: event.userAgent ?? null,
    tenantId: event.tenantId ?? null,
  });
}

export function registerAuditRoutes(app: FastifyInstance, db: any) {
  app.get(
    "/api/admin-svc/audit-log",
    {
      schema: getAdminSvcAuditLogSchema,
      preHandler: (req, reply) => requirePermission(req, reply, Permission.AuditRead),
    },
    async (request) => {
      const {
        action,
        actorId,
        resourceType,
        resourceId,
        from,
        to,
        page = "1",
        pageSize = "50",
        search,
        sort,
      } = request.query as any;

      const pageNum = Math.max(1, Number(page));
      const size = Math.max(1, Math.min(100, Number(pageSize)));
      const offset = (pageNum - 1) * size;

      const conditions: any[] = [];
      if (action) conditions.push(eq(adminAuditLog.action, action));
      if (actorId) conditions.push(eq(adminAuditLog.actorId, actorId));
      if (resourceType) conditions.push(eq(adminAuditLog.resourceType, resourceType));
      if (resourceId) conditions.push(eq(adminAuditLog.resourceId, resourceId));
      if (from) conditions.push(gte(adminAuditLog.createdAt, new Date(from)));
      if (to) conditions.push(lte(adminAuditLog.createdAt, new Date(to)));
      if (search) {
        conditions.push(
          or(
            ilike(adminAuditLog.actorEmail, `%${search}%`),
            ilike(adminAuditLog.action, `%${search}%`),
            sql`${adminAuditLog.details}::text ILIKE ${"%" + search + "%"}`,
          ),
        );
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [totalResult] = await db.select({ count: count() }).from(adminAuditLog).where(where);

      // Sprint B3 — whitelisted sort; anything else keeps newest-first.
      const order = sort === "createdAt:asc" ? asc(adminAuditLog.createdAt) : desc(adminAuditLog.createdAt);
      const entries = await db
        .select()
        .from(adminAuditLog)
        .where(where)
        .orderBy(order)
        .limit(size)
        .offset(offset);

      return { entries, total: totalResult.count, page: pageNum, pageSize: size };
    },
  );

  // Sprint B3 — audited CSV export of the SAME filtered query. The export
  // event lands on the audit log BEFORE streaming begins, so "who exported
  // what" is answerable even for aborted downloads.
  app.get(
    "/api/admin-svc/audit-log/export.csv",
    {
      schema: getAdminSvcAuditLogSchema,
      preHandler: (req, reply) => requirePermission(req, reply, Permission.AuditRead),
    },
    async (request: any, reply) => {
      const { action, actorId, resourceType, resourceId, from, to, search, sort } =
        request.query as any;
      const conditions: any[] = [];
      if (action) conditions.push(eq(adminAuditLog.action, action));
      if (actorId) conditions.push(eq(adminAuditLog.actorId, actorId));
      if (resourceType) conditions.push(eq(adminAuditLog.resourceType, resourceType));
      if (resourceId) conditions.push(eq(adminAuditLog.resourceId, resourceId));
      if (from) conditions.push(gte(adminAuditLog.createdAt, new Date(from)));
      if (to) conditions.push(lte(adminAuditLog.createdAt, new Date(to)));
      if (search) {
        conditions.push(
          or(
            ilike(adminAuditLog.actorEmail, `%${search}%`),
            ilike(adminAuditLog.action, `%${search}%`),
            sql`${adminAuditLog.details}::text ILIKE ${"%" + search + "%"}`,
          ),
        );
      }
      const where = conditions.length > 0 ? and(...conditions) : undefined;

      // Canonical 11-key writer profile (all keys, nulls explicit) so the
      // chain verifier can recompute this row — see audit-chain-verify.ts.
      await appendAudit(db, "admin_audit_log", adminAuditLog, {
        action: "admin.data.exported",
        actorId: request.user?.sub ?? "unknown",
        actorEmail: request.user?.email ?? null,
        actorRole: String(request.user?.role ?? "UNKNOWN"),
        onBehalfOfId: null,
        resourceType: "audit_log",
        resourceId: null,
        tenantId: null,
        details: { filters: { action, actorId, resourceType, resourceId, from, to, search } },
        ipAddress: (request.headers["x-forwarded-for"] as string) || request.ip || null,
        userAgent: (request.headers["user-agent"] as string) || null,
      });

      const write = startCsv(reply, "audit-log.csv", [
        "createdAt",
        "action",
        "actorEmail",
        "actorRole",
        "resourceType",
        "resourceId",
        "tenantId",
        "details",
      ]);
      const order = sort === "createdAt:asc" ? asc(adminAuditLog.createdAt) : desc(adminAuditLog.createdAt);
      const batch = 1_000;
      for (let offset = 0; offset < EXPORT_ROW_CAP; offset += batch) {
        const rows = await db
          .select()
          .from(adminAuditLog)
          .where(where)
          .orderBy(order)
          .limit(batch)
          .offset(offset);
        for (const row of rows) {
          write([
            row.createdAt?.toISOString?.() ?? row.createdAt,
            row.action,
            row.actorEmail,
            row.actorRole,
            row.resourceType,
            row.resourceId,
            row.tenantId,
            row.details,
          ]);
        }
        if (rows.length < batch) break;
      }
      reply.raw.end();
      return reply;
    },
  );

  app.get(
    "/api/admin-svc/activity",
    {
      schema: getAdminSvcActivitySchema,
      preHandler: (req, reply) => requirePermission(req, reply, Permission.AuditRead),
    },
    async () => {
      const entries = await db
        .select()
        .from(adminAuditLog)
        .orderBy(desc(adminAuditLog.createdAt))
        .limit(20);
      return entries;
    },
  );

  registerReadEventRoute(app, db);
}

// ── Sprint B4 — sensitive-READ auditing ─────────────────────────────────
// "Who viewed this child's data, when" must be answerable in-product, so
// the web-admin detail pages report each sensitive view here. Events land
// hash-chained on admin_audit_log (platform trail) and, when the resource
// belongs to a tenant, on district_activity_log too — that is the row a
// district admin sees on their own audit page. Per-(actor, resource)
// dedupe keeps a page refresh from spamming the trail; the window is
// documented in docs/audit-event-taxonomy.md.

const READ_EVENT_ACTIONS: Record<string, string> = {
  "admin.user.viewed": "user",
  "admin.learner.viewed": "learner",
  "admin.dsar.viewed": "dsar_request",
};
const READ_EVENT_BATCH_CAP = 20;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface AdminReadEventInput {
  action: string;
  resourceType: string;
  resourceId: string;
  tenantId?: string | null;
}

// Process-local on purpose: across replicas/restarts the worst case is an
// extra TRUE read event, never a lost one.
const readDedupe = createReadDedupe();

export function registerReadEventRoute(app: FastifyInstance, db: any) {
  app.post(
    "/api/admin-svc/audit-log/read-events",
    {
      schema: postAdminSvcAuditLogReadEventsSchema,
      // UserRead is the same permission that grants the detail pages
      // being audited — anyone able to view must be able to self-report.
      preHandler: (req, reply) => requirePermission(req, reply, Permission.UserRead),
    },
    async (request: any, reply) => {
      const body = request.body as { events?: unknown };
      const events = Array.isArray(body?.events) ? body.events : null;
      if (!events || events.length === 0 || events.length > READ_EVENT_BATCH_CAP) {
        return reply
          .status(400)
          .send({ error: `events must be a 1..${READ_EVENT_BATCH_CAP} item array` });
      }

      for (const raw of events) {
        const e = raw as AdminReadEventInput;
        const expectedType = READ_EVENT_ACTIONS[e?.action ?? ""];
        if (!expectedType) {
          return reply.status(400).send({ error: `unsupported read action: ${String(e?.action)}` });
        }
        if (e.resourceType !== expectedType) {
          return reply
            .status(400)
            .send({ error: `resourceType for ${e.action} must be ${expectedType}` });
        }
        if (typeof e.resourceId !== "string" || !e.resourceId || e.resourceId.length > 255) {
          return reply.status(400).send({ error: "resourceId must be a non-empty string" });
        }
        if (e.tenantId != null && !UUID_RE.test(String(e.tenantId))) {
          return reply.status(400).send({ error: "tenantId must be a uuid when present" });
        }
      }

      const actorId = String(request.user?.sub ?? "");
      const actorEmail = request.user?.email ?? null;
      const actorRole = String(request.user?.role ?? "UNKNOWN");
      const ipAddress = (request.headers["x-forwarded-for"] as string) || request.ip || null;
      const userAgent = (request.headers["user-agent"] as string) || null;

      let recorded = 0;
      let deduped = 0;
      for (const raw of events) {
        const e = raw as AdminReadEventInput;
        if (!readDedupe.shouldEmit(actorId, e.action, e.resourceType, e.resourceId)) {
          deduped += 1;
          continue;
        }
        // NO content fields in details — the redaction taxonomy forbids
        // IEP/medical/free-text in audit metadata. Actor + resource + tenant
        // identify the access; the resource row itself holds the data.
        await appendAudit(db, "admin_audit_log", adminAuditLog, {
          action: e.action,
          actorId,
          actorEmail,
          actorRole,
          onBehalfOfId: null,
          resourceType: e.resourceType,
          resourceId: e.resourceId,
          details: {},
          ipAddress,
          userAgent,
          tenantId: e.tenantId ?? null,
        });
        if (e.tenantId && UUID_RE.test(actorId)) {
          // District-visible copy: this row is what lets a district answer
          // "who viewed this child's data" on its OWN audit page. FK
          // constraints (actor/tenant must exist in this DB) are enforced —
          // a violation must never void the platform row above.
          try {
            await appendAudit(db, "district_activity_log", districtActivityLog, {
              tenantId: e.tenantId,
              action: e.action,
              actorId,
              actorName: actorEmail,
              onBehalfOfId: null,
              resourceType: e.resourceType,
              resourceId: e.resourceId,
              details: {},
            });
          } catch (err) {
            request.log.warn(
              { err, tenantId: e.tenantId },
              "read-event: district trail append failed (platform row recorded)",
            );
          }
        }
        recorded += 1;
      }

      return { recorded, deduped };
    },
  );
}
