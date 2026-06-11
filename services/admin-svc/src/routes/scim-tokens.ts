/**
 * Sprint 6: SCIM bearer token administration (per-tenant).
 *
 * Used by the district SSO settings page to issue, list, and revoke the
 * tokens that IdPs use to call /scim/v2/*.
 *
 * Auth: caller must be DISTRICT_ADMIN (for the same tenantId) or
 * PLATFORM_ADMIN. Tokens are stored sha256-hashed; the plaintext is
 * shown exactly once at creation.
 */

import { FastifyInstance } from "fastify";
import crypto from "crypto";
import { eq, and, desc, isNull, sql, count } from "drizzle-orm";
import { scimTokens, scimUnmappedGroups, adminAuditLog, appendAudit } from "@aivo/db";
import { verifyJWT } from "@aivo/security";
import {
  getAdminSvcScimTokensSchema,
  adminSvcScimTokensSchema,
  adminSvcScimTokensByIdRevokeSchema,
  getAdminSvcScimUnmappedGroupsSchema,
  adminSvcScimUnmappedGroupsByIdResolveSchema,
  getAdminSvcScimActivitySchema,
} from "./schemas.js";

function clientIp(req: any): string | null {
  return req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() || req.ip || null;
}

async function requireTenantAdmin(req: any, reply: any) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer "))
    return reply.status(401).send({ error: "Missing authorization" });
  try {
    const payload = await verifyJWT<any>(auth.slice(7));
    if (payload.role !== "PLATFORM_ADMIN" && payload.role !== "DISTRICT_ADMIN") {
      return reply.status(403).send({ error: "District or platform admin required" });
    }
    req.user = payload;
  } catch {
    return reply.status(401).send({ error: "Invalid token" });
  }
}

function ensureTenantScope(req: any, tenantId: string): boolean {
  return req.user.role === "PLATFORM_ADMIN" || req.user.tenantId === tenantId;
}

export function registerScimTokenRoutes(app: FastifyInstance, db: any) {
  app.get(
    "/api/admin-svc/scim-tokens",
    { schema: getAdminSvcScimTokensSchema, preHandler: requireTenantAdmin },
    async (req: any, reply) => {
      const tenantId =
        req.user.role === "PLATFORM_ADMIN"
          ? (req.query?.tenantId as string) || req.user.tenantId
          : req.user.tenantId;
      if (!tenantId) return reply.status(400).send({ error: "tenantId required" });
      const rows = await db
        .select({
          id: scimTokens.id,
          name: scimTokens.name,
          prefix: scimTokens.prefix,
          createdAt: scimTokens.createdAt,
          lastUsedAt: scimTokens.lastUsedAt,
          revokedAt: scimTokens.revokedAt,
        })
        .from(scimTokens)
        .where(eq(scimTokens.tenantId, tenantId))
        .orderBy(desc(scimTokens.createdAt));
      return { tokens: rows };
    },
  );

  app.post(
    "/api/admin-svc/scim-tokens",
    { schema: adminSvcScimTokensSchema, preHandler: requireTenantAdmin },
    async (req: any, reply) => {
      const { name, tenantId: bodyTenant } = (req.body || {}) as {
        name?: string;
        tenantId?: string;
      };
      if (!name) return reply.status(400).send({ error: "name required" });
      const tenantId = bodyTenant || req.user.tenantId;
      if (!ensureTenantScope(req, tenantId)) {
        return reply.status(403).send({ error: "Cannot issue token for another tenant" });
      }

      const plain = `aivo-scim_${crypto.randomBytes(32).toString("base64url")}`;
      const tokenHash = crypto.createHash("sha256").update(plain).digest("hex");
      const prefix = plain.slice(0, 16);

      const [created] = await db
        .insert(scimTokens)
        .values({
          tenantId,
          tokenHash,
          prefix,
          name,
          createdBy: req.user.sub,
        })
        .returning();

      await appendAudit(db, "admin_audit_log", adminAuditLog, {
        action: "SCIM_TOKEN_ISSUED",
        actorId: req.user.impersonatedBy || req.user.sub,
        actorEmail: req.user.email || "",
        actorRole: req.user.role,
        onBehalfOfId: req.user.impersonatedBy ? req.user.sub : null,
        resourceType: "scim_token",
        resourceId: created.id,
        details: { name, prefix },
        ipAddress: clientIp(req),
        userAgent: (req.headers["user-agent"] as string) || null,
        tenantId,
      });

      return reply.status(201).send({
        token: { ...created, tokenHash: undefined },
        plaintext: plain,
        warning: "This token will only be shown once. Store it in your IdP immediately.",
      });
    },
  );

  app.post(
    "/api/admin-svc/scim-tokens/:id/revoke",
    { schema: adminSvcScimTokensByIdRevokeSchema, preHandler: requireTenantAdmin },
    async (req: any, reply) => {
      const { id } = req.params as { id: string };
      const [existing] = await db.select().from(scimTokens).where(eq(scimTokens.id, id)).limit(1);
      if (!existing) return reply.status(404).send({ error: "Token not found" });
      if (!ensureTenantScope(req, existing.tenantId)) {
        return reply.status(403).send({ error: "Cannot revoke another tenant's token" });
      }
      if (existing.revokedAt) return { ok: true, alreadyRevoked: true };
      await db.update(scimTokens).set({ revokedAt: new Date() }).where(eq(scimTokens.id, id));
      await appendAudit(db, "admin_audit_log", adminAuditLog, {
        action: "SCIM_TOKEN_REVOKED",
        actorId: req.user.impersonatedBy || req.user.sub,
        actorEmail: req.user.email || "",
        actorRole: req.user.role,
        onBehalfOfId: req.user.impersonatedBy ? req.user.sub : null,
        resourceType: "scim_token",
        resourceId: existing.id,
        details: { name: existing.name },
        ipAddress: clientIp(req),
        userAgent: (req.headers["user-agent"] as string) || null,
        tenantId: existing.tenantId,
      });
      return { ok: true };
    },
  );

  // ── Sprint B5 — unmapped-group review + sync activity ─────────────────
  // IdP group pushes that didn't match the class convention are recorded
  // by identity-svc; the district SIS page lists them here so nothing the
  // IdP sent is silently dropped.

  app.get(
    "/api/admin-svc/scim-unmapped-groups",
    { schema: getAdminSvcScimUnmappedGroupsSchema, preHandler: requireTenantAdmin },
    async (req: any, reply) => {
      const tenantId =
        req.user.role === "PLATFORM_ADMIN"
          ? (req.query?.tenantId as string) || req.user.tenantId
          : req.user.tenantId;
      if (!tenantId) return reply.status(400).send({ error: "tenantId required" });
      const includeResolved = req.query?.includeResolved === "1";
      const where = includeResolved
        ? eq(scimUnmappedGroups.tenantId, tenantId)
        : and(eq(scimUnmappedGroups.tenantId, tenantId), isNull(scimUnmappedGroups.resolvedAt));
      const rows = await db
        .select()
        .from(scimUnmappedGroups)
        .where(where)
        .orderBy(desc(scimUnmappedGroups.lastSeenAt))
        .limit(200);
      return { groups: rows };
    },
  );

  app.post(
    "/api/admin-svc/scim-unmapped-groups/:id/resolve",
    { schema: adminSvcScimUnmappedGroupsByIdResolveSchema, preHandler: requireTenantAdmin },
    async (req: any, reply) => {
      const { id } = req.params as { id: string };
      const [existing] = await db
        .select()
        .from(scimUnmappedGroups)
        .where(eq(scimUnmappedGroups.id, id))
        .limit(1);
      if (!existing) return reply.status(404).send({ error: "Not found" });
      if (!ensureTenantScope(req, existing.tenantId)) {
        return reply.status(403).send({ error: "Cannot resolve another tenant's record" });
      }
      await db
        .update(scimUnmappedGroups)
        .set({ resolvedAt: new Date(), resolvedBy: req.user.sub })
        .where(eq(scimUnmappedGroups.id, id));
      await appendAudit(db, "admin_audit_log", adminAuditLog, {
        action: "SCIM_UNMAPPED_GROUP_RESOLVED",
        actorId: req.user.impersonatedBy || req.user.sub,
        actorEmail: req.user.email || "",
        actorRole: req.user.role,
        onBehalfOfId: req.user.impersonatedBy ? req.user.sub : null,
        resourceType: "scim_unmapped_group",
        resourceId: existing.id,
        details: { displayName: existing.displayName, reason: existing.reason },
        ipAddress: clientIp(req),
        userAgent: (req.headers["user-agent"] as string) || null,
        tenantId: existing.tenantId,
      });
      return { ok: true };
    },
  );

  // Per-resource sync counters for the SIS page — real numbers from the
  // hash-chained audit trail (SCIM_* actions recorded by identity-svc).
  app.get(
    "/api/admin-svc/scim-activity",
    { schema: getAdminSvcScimActivitySchema, preHandler: requireTenantAdmin },
    async (req: any, reply) => {
      const tenantId =
        req.user.role === "PLATFORM_ADMIN"
          ? (req.query?.tenantId as string) || req.user.tenantId
          : req.user.tenantId;
      if (!tenantId) return reply.status(400).send({ error: "tenantId required" });
      const rows = await db
        .select({ action: adminAuditLog.action, n: count() })
        .from(adminAuditLog)
        .where(
          and(
            eq(adminAuditLog.tenantId, tenantId),
            sql`${adminAuditLog.action} LIKE 'SCIM_%'`,
          ),
        )
        .groupBy(adminAuditLog.action);
      const counters: Record<string, number> = {};
      for (const row of rows) counters[row.action] = Number(row.n);
      const [lastUsed] = await db
        .select({ lastUsedAt: scimTokens.lastUsedAt })
        .from(scimTokens)
        .where(and(eq(scimTokens.tenantId, tenantId), isNull(scimTokens.revokedAt)))
        .orderBy(desc(scimTokens.lastUsedAt))
        .limit(1);
      return { counters, lastSyncAt: lastUsed?.lastUsedAt ?? null };
    },
  );
}
