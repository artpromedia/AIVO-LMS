import { FastifyInstance } from "fastify";
import { adminAuditLog, appendAudit } from "@aivo/db";
import { Permission } from "@aivo/security";
import { eq, desc, asc, sql, and, gte, lte, or, count, ilike } from "drizzle-orm";
import { startCsv, EXPORT_ROW_CAP } from "../lib/csv.js";
import { getAdminSvcAuditLogSchema, getAdminSvcActivitySchema } from "./schemas.js";
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
            sql`${adminAuditLog.details}::text ILIKE ${"%" + search + "%"}`,
          ),
        );
      }
      const where = conditions.length > 0 ? and(...conditions) : undefined;

      await appendAudit(db, "admin_audit_log", adminAuditLog, {
        action: "admin.data.exported",
        actorId: request.user?.sub ?? "unknown",
        actorEmail: request.user?.email ?? null,
        actorRole: String(request.user?.role ?? "UNKNOWN"),
        resourceType: "audit_log",
        resourceId: null,
        tenantId: null,
        details: { filters: { action, actorId, resourceType, resourceId, from, to, search } },
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
}
