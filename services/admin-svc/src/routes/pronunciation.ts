/**
 * TTS pronunciation overrides.
 *
 * Postgres-backed (pronunciation_overrides in @aivo/db), replacing the
 * in-memory store the legacy web-v2 admin used. Surfaced in the web-admin
 * platform console.
 *
 *   GET    /api/admin-svc/audio/pronunciation       — list (ordered by token)
 *   POST   /api/admin-svc/audio/pronunciation       — create
 *   DELETE /api/admin-svc/audio/pronunciation/:id    — remove
 *
 * Every write is hash-chained into admin_audit_log via appendAudit.
 */
import { FastifyInstance } from "fastify";
import { asc, eq } from "drizzle-orm";
import { pronunciationOverrides, adminAuditLog, appendAudit } from "@aivo/db";
import { verifyJWT } from "@aivo/security";

const ENCODINGS = new Set(["ipa", "x-sampa", "plain"]);
const SCOPES = new Set(["platform", "tenant"]);

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

function mapOverride(row: any) {
  return {
    id: row.id,
    tenantId: row.tenantId ?? null,
    token: row.token,
    replacement: row.replacement,
    encoding: row.encoding,
    scope: row.scope,
    notes: row.notes ?? null,
    createdByUserId: row.createdByUserId ?? null,
    createdAt: row.createdAt?.toISOString?.() ?? null,
  };
}

async function audit(db: any, action: string, actor: any, override: any, details: Record<string, any>) {
  await appendAudit(db, "admin_audit_log", adminAuditLog, {
    action,
    actorId: actor.impersonatedBy || actor.sub,
    actorEmail: actor.email || "",
    actorRole: actor.role,
    onBehalfOfId: actor.impersonatedBy ? actor.sub : null,
    resourceType: "pronunciation_override",
    resourceId: override.id,
    details,
    ipAddress: null,
    userAgent: null,
    tenantId: actor.tenantId ?? null,
  });
}

export function registerPronunciationRoutes(app: FastifyInstance, db: any): void {
  app.get(
    "/api/admin-svc/audio/pronunciation",
    { schema: { tags: ["audio"], security: [{ bearerAuth: [] }] } },
    async (req, reply) => {
      if (!(await requirePlatformAdmin(req, reply))) return;
      const rows = await db
        .select()
        .from(pronunciationOverrides)
        .orderBy(asc(pronunciationOverrides.token));
      return { overrides: rows.map(mapOverride) };
    },
  );

  app.post<{
    Body: {
      token?: string;
      replacement?: string;
      encoding?: string;
      scope?: string;
      tenantId?: string | null;
      notes?: string | null;
    };
  }>(
    "/api/admin-svc/audio/pronunciation",
    { schema: { tags: ["audio"], security: [{ bearerAuth: [] }] } },
    async (req, reply) => {
      if (!(await requirePlatformAdmin(req, reply))) return;
      const body = req.body ?? {};
      const token = String(body.token ?? "").trim();
      const replacement = String(body.replacement ?? "").trim();
      if (!token || !replacement) {
        return reply.code(400).send({ error: "token and replacement are required" });
      }
      const encoding = ENCODINGS.has(String(body.encoding)) ? String(body.encoding) : "plain";
      const scope = SCOPES.has(String(body.scope)) ? String(body.scope) : "tenant";
      // Platform-scope rows carry a NULL tenant_id; tenant-scope requires one.
      const tenantId = scope === "platform" ? null : (body.tenantId ? String(body.tenantId) : null);
      if (scope === "tenant" && !tenantId) {
        return reply.code(400).send({ error: "tenantId is required for tenant scope" });
      }
      const [created] = await db
        .insert(pronunciationOverrides)
        .values({
          tenantId,
          token,
          replacement,
          encoding,
          scope,
          notes: body.notes ? String(body.notes) : null,
          createdByUserId: (req as any).user?.sub ?? null,
        })
        .returning();
      await audit(db, "pronunciation_override_created", (req as any).user, created, { token, scope, encoding });
      return reply.code(201).send({ override: mapOverride(created) });
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/api/admin-svc/audio/pronunciation/:id",
    { schema: { tags: ["audio"], security: [{ bearerAuth: [] }] } },
    async (req, reply) => {
      if (!(await requirePlatformAdmin(req, reply))) return;
      const { id } = req.params;
      const [removed] = await db
        .delete(pronunciationOverrides)
        .where(eq(pronunciationOverrides.id, id))
        .returning();
      if (!removed) return reply.code(404).send({ error: "override_not_found" });
      await audit(db, "pronunciation_override_removed", (req as any).user, removed, { token: removed.token });
      return { removed: true };
    },
  );
}
