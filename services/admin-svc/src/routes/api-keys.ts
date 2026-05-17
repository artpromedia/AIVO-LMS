/**
 * Sprint 7: API key administration.
 *
 * Endpoints (all require PLATFORM_ADMIN):
 *   GET    /api/admin-svc/api-keys              — list (masked)
 *   POST   /api/admin-svc/api-keys              — create, returns plaintext ONCE
 *   POST   /api/admin-svc/api-keys/:id/rotate   — issue replacement, 24h grace
 *   POST   /api/admin-svc/api-keys/:id/revoke   — revoke immediately
 *
 * Storage: argon2id hash + 10-char prefix (`aivo_xxxx`). Default expiry
 * 90 days. Rotation creates a new row with `rotatedFromId` referencing the
 * old key, and sets `gracePeriodEndsAt = now+24h` on the prior key so
 * existing callers keep working during deploy.
 *
 * Every operation is hash-chained into admin_audit_log via appendAudit.
 */

import { FastifyInstance } from "fastify";
import { eq, and, isNull, or, sql, desc } from "drizzle-orm";
import argon2 from "argon2";
import crypto from "crypto";
import { apiKeys, adminAuditLog, appendAudit } from "@aivo/db";
import { verifyJWT } from "@aivo/security";
import { getAdminSvcApiKeysSchema, adminSvcApiKeysSchema, adminSvcApiKeysByIdRotateSchema, adminSvcApiKeysByIdRevokeSchema } from "./schemas.js";

const DEFAULT_EXPIRY_DAYS = 90;
const ROTATION_GRACE_HOURS = 24;

async function requirePlatformAdmin(req: any, reply: any) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return reply.status(401).send({ error: "Missing authorization" });
  try {
    const payload = await verifyJWT<any>(auth.slice(7));
    if (payload.role !== "PLATFORM_ADMIN") {
      return reply.status(403).send({ error: "Platform admin access required" });
    }
    req.user = payload;
  } catch {
    return reply.status(401).send({ error: "Invalid token" });
  }
}

function generateApiKey(): { plain: string; prefix: string } {
  const body = crypto.randomBytes(24).toString("base64url");
  const plain = `aivo_${body}`;
  return { plain, prefix: plain.slice(0, 10) };
}

function clientIp(req: any): string | null {
  return req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() || req.ip || null;
}

async function logKeyAction(
  db: any, action: string, actor: any, key: any, details: Record<string, any>, req: any,
): Promise<void> {
  await appendAudit(db, "admin_audit_log", adminAuditLog, {
    action,
    actorId: actor.impersonatedBy || actor.sub,
    actorEmail: actor.email || "",
    actorRole: actor.role,
    onBehalfOfId: actor.impersonatedBy ? actor.sub : null,
    resourceType: "api_key",
    resourceId: key.id,
    details,
    ipAddress: clientIp(req),
    userAgent: req.headers["user-agent"] as string || null,
    tenantId: actor.tenantId,
  });
}

export function registerApiKeyRoutes(app: FastifyInstance, db: any) {
  app.get("/api/admin-svc/api-keys", { schema: getAdminSvcApiKeysSchema, preHandler: requirePlatformAdmin }, async () => {
    const rows = await db.select({
      id: apiKeys.id,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      scopes: apiKeys.scopes,
      tenantId: apiKeys.tenantId,
      createdBy: apiKeys.createdBy,
      expiresAt: apiKeys.expiresAt,
      lastUsedAt: apiKeys.lastUsedAt,
      revokedAt: apiKeys.revokedAt,
      rotatedFromId: apiKeys.rotatedFromId,
      gracePeriodEndsAt: apiKeys.gracePeriodEndsAt,
      createdAt: apiKeys.createdAt,
    }).from(apiKeys).orderBy(desc(apiKeys.createdAt));
    return { keys: rows };
  });

  app.post("/api/admin-svc/api-keys", { schema: adminSvcApiKeysSchema, preHandler: requirePlatformAdmin }, async (req: any, reply) => {
    const { name, scopes, expiresInDays, tenantId } = (req.body || {}) as {
      name?: string; scopes?: string[]; expiresInDays?: number; tenantId?: string;
    };
    if (!name || !Array.isArray(scopes) || scopes.length === 0) {
      return reply.status(400).send({ error: "name and scopes[] are required" });
    }
    const days = Math.min(365, Math.max(1, expiresInDays || DEFAULT_EXPIRY_DAYS));
    const { plain, prefix } = generateApiKey();
    const keyHash = await argon2.hash(plain, { type: argon2.argon2id });
    const [created] = await db.insert(apiKeys).values({
      keyHash,
      keyPrefix: prefix,
      name,
      scopes,
      tenantId: tenantId || null,
      createdBy: req.user.sub,
      expiresAt: new Date(Date.now() + days * 86_400_000),
    } as any).returning();

    await logKeyAction(db, "API_KEY_CREATED", req.user, created,
      { name, scopes, expiresInDays: days }, req);

    return reply.status(201).send({
      key: { ...created, keyHash: undefined },
      plaintext: plain,
      warning: "This key will only be shown once. Store it securely.",
    });
  });

  app.post("/api/admin-svc/api-keys/:id/rotate", { schema: adminSvcApiKeysByIdRotateSchema, preHandler: requirePlatformAdmin }, async (req: any, reply) => {
    const { id } = req.params as { id: string };
    const [existing] = await db.select().from(apiKeys).where(eq(apiKeys.id, id)).limit(1);
    if (!existing) return reply.status(404).send({ error: "Key not found" });
    if (existing.revokedAt) return reply.status(400).send({ error: "Cannot rotate a revoked key" });

    const { plain, prefix } = generateApiKey();
    const keyHash = await argon2.hash(plain, { type: argon2.argon2id });
    const days = DEFAULT_EXPIRY_DAYS;

    const [created] = await db.insert(apiKeys).values({
      keyHash, keyPrefix: prefix,
      name: existing.name,
      scopes: existing.scopes,
      tenantId: existing.tenantId,
      createdBy: req.user.sub,
      expiresAt: new Date(Date.now() + days * 86_400_000),
      rotatedFromId: existing.id,
    } as any).returning();

    // Mark the old key with a 24h grace overlap. It is NOT revoked; it
    // just stops working at gracePeriodEndsAt (callers should enforce that
    // when validating a presented key).
    await db.update(apiKeys).set({
      gracePeriodEndsAt: new Date(Date.now() + ROTATION_GRACE_HOURS * 3600_000),
    }).where(eq(apiKeys.id, existing.id));

    await logKeyAction(db, "API_KEY_ROTATED", req.user, created,
      { rotatedFromId: existing.id, graceHours: ROTATION_GRACE_HOURS }, req);

    return reply.status(201).send({
      key: { ...created, keyHash: undefined },
      plaintext: plain,
      previousKeyId: existing.id,
      gracePeriodEndsAt: new Date(Date.now() + ROTATION_GRACE_HOURS * 3600_000),
      warning: `This key will only be shown once. The previous key (${existing.keyPrefix}...) will continue working for ${ROTATION_GRACE_HOURS} hours.`,
    });
  });

  app.post("/api/admin-svc/api-keys/:id/revoke", { schema: adminSvcApiKeysByIdRevokeSchema, preHandler: requirePlatformAdmin }, async (req: any, reply) => {
    const { id } = req.params as { id: string };
    const [existing] = await db.select().from(apiKeys).where(eq(apiKeys.id, id)).limit(1);
    if (!existing) return reply.status(404).send({ error: "Key not found" });
    if (existing.revokedAt) return { ok: true, alreadyRevoked: true };

    await db.update(apiKeys).set({
      revokedAt: new Date(),
      gracePeriodEndsAt: new Date(),
    }).where(eq(apiKeys.id, id));

    await logKeyAction(db, "API_KEY_REVOKED", req.user, existing, { keyPrefix: existing.keyPrefix }, req);
    return { ok: true };
  });
}

/**
 * Validate a presented API key against `api_keys`. Used by other services
 * via internal HTTP. Honors the rotation grace period and revocation.
 */
export async function validateApiKey(db: any, presented: string): Promise<{
  valid: boolean; keyId?: string; tenantId?: string | null; scopes?: string[]; reason?: string;
}> {
  if (!presented?.startsWith("aivo_")) return { valid: false, reason: "malformed" };
  const prefix = presented.slice(0, 10);
  const candidates = await db.select().from(apiKeys)
    .where(and(eq(apiKeys.keyPrefix, prefix), isNull(apiKeys.revokedAt)));
  const now = Date.now();
  for (const c of candidates) {
    if (c.expiresAt && c.expiresAt.getTime() < now) continue;
    if (c.gracePeriodEndsAt && c.gracePeriodEndsAt.getTime() < now) continue;
    try {
      if (await argon2.verify(c.keyHash, presented)) {
        db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, c.id)).catch(() => {});
        return { valid: true, keyId: c.id, tenantId: c.tenantId, scopes: c.scopes as string[] };
      }
    } catch {/* keep trying */}
  }
  return { valid: false, reason: "no_match" };
}
