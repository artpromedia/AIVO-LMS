/**
 * Sprint 10 — admin-svc as the BFF for platform reads.
 *
 * Each `/api/admin-svc/{stats,users,learners,tenants}*` GET proxies to
 * identity-svc with the caller's Bearer token + query string forwarded.
 * This consolidates the read surface so identity-svc can focus on
 * writes; the legacy identity-svc reads remain functional for one
 * deprecation cycle (Deprecation/Sunset headers added on that side).
 *
 * Writes (`PUT /config`) stay local because they target tables owned by
 * admin-svc (`platform_config`). Each config write inserts a new
 * append-only history row; `GET /config/history` returns the trail.
 */
import { FastifyInstance, FastifyReply } from "fastify";
import { platformConfig, users } from "@aivo/db";
import { verifyJWT } from "@aivo/security";
import { desc, eq } from "drizzle-orm";
import { logAuditEvent } from "./audit.js";
import {
  getAdminSvcStatsSchema,
  getAdminSvcUsersSchema,
  getAdminSvcUsersByIdSchema,
  getAdminSvcLearnersSchema,
  getAdminSvcLearnersByIdSchema,
  getAdminSvcTenantsSchema,
  getAdminSvcTenantsByIdSchema,
  adminSvcAiPlaygroundSchema,
  getAdminSvcConfigSchema,
  updateAdminSvcConfigSchema,
  getAdminSvcConfigHistorySchema,
} from "./schemas.js";

const IS_PROD = process.env.NODE_ENV === "production";
function requireUrl(name: string, devDefault: string): string {
  const v = process.env[name];
  if (v) return v;
  if (IS_PROD) throw new Error(`admin-svc: ${name} must be set in production`);
  return devDefault;
}
const IDENTITY_URL = requireUrl("IDENTITY_SVC_URL", "http://localhost:3001");
const BRAIN_URL = requireUrl("BRAIN_SVC_URL", "http://localhost:8000");

async function requireAdmin(req: any, reply: any) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return reply.status(401).send({ error: "Missing authorization header" });
  }
  try {
    const payload = await verifyJWT(auth.slice(7));
    if (!["PLATFORM_ADMIN", "DISTRICT_ADMIN"].includes(payload.role as string)) {
      return reply.status(403).send({ error: "Admin access required" });
    }
    req.user = payload;
  } catch {
    return reply.status(401).send({ error: "Invalid token" });
  }
}

/**
 * Forward the request to identity-svc preserving auth, query string,
 * and content-type. The downstream JSON body is streamed back as-is so
 * pagination and shape stay identical to the legacy endpoints.
 */
async function proxyToIdentity(req: any, reply: FastifyReply, downstreamPath: string) {
  const url = new URL(downstreamPath, IDENTITY_URL);
  const incoming = (req.raw?.url || req.url || "") as string;
  const qIdx = incoming.indexOf("?");
  if (qIdx >= 0) url.search = incoming.slice(qIdx);
  let res: Response;
  try {
    res = await fetch(url, {
      method: req.method,
      headers: {
        authorization: req.headers.authorization,
        "content-type": (req.headers["content-type"] as string) || "application/json",
      },
      signal: AbortSignal.timeout(8000),
    });
  } catch (e: any) {
    req.log?.error({ err: e?.message, downstreamPath }, "identity-svc proxy failed");
    return reply.status(502).send({ error: "Upstream identity-svc unavailable" });
  }
  // Forward content-type + status + body. Drop the deprecation headers
  // here — admin-svc is the new canonical surface, so callers should
  // see a clean response.
  reply.status(res.status);
  const ct = res.headers.get("content-type");
  if (ct) reply.header("content-type", ct);
  const text = await res.text();
  return reply.send(text);
}

export function registerPlatformRoutes(app: FastifyInstance, db: any) {
  // ── Read proxies ──────────────────────────────────────────────────
  app.get(
    "/api/admin-svc/stats",
    { schema: getAdminSvcStatsSchema, preHandler: requireAdmin },
    async (req, reply) => proxyToIdentity(req, reply, "/api/admin/stats"),
  );

  app.get(
    "/api/admin-svc/users",
    { schema: getAdminSvcUsersSchema, preHandler: requireAdmin },
    async (req, reply) => proxyToIdentity(req, reply, "/api/admin/users"),
  );
  app.get(
    "/api/admin-svc/users/:id",
    { schema: getAdminSvcUsersByIdSchema, preHandler: requireAdmin },
    async (req: any, reply) =>
      proxyToIdentity(req, reply, `/api/admin/users/${encodeURIComponent(req.params.id)}`),
  );

  app.get(
    "/api/admin-svc/learners",
    { schema: getAdminSvcLearnersSchema, preHandler: requireAdmin },
    async (req, reply) => proxyToIdentity(req, reply, "/api/admin/learners"),
  );
  app.get(
    "/api/admin-svc/learners/:id",
    { schema: getAdminSvcLearnersByIdSchema, preHandler: requireAdmin },
    async (req: any, reply) =>
      proxyToIdentity(req, reply, `/api/admin/learners/${encodeURIComponent(req.params.id)}`),
  );

  app.get(
    "/api/admin-svc/tenants",
    { schema: getAdminSvcTenantsSchema, preHandler: requireAdmin },
    async (req, reply) => proxyToIdentity(req, reply, "/api/admin/tenants"),
  );
  app.get(
    "/api/admin-svc/tenants/:id",
    { schema: getAdminSvcTenantsByIdSchema, preHandler: requireAdmin },
    async (req: any, reply) =>
      proxyToIdentity(req, reply, `/api/admin/tenants/${encodeURIComponent(req.params.id)}`),
  );

  // ── AI Prompt Playground (proxy to brain-svc) ─────────────────────
  // Admin-only test surface for tutor system prompts. Forwards the
  // full request body + bearer token to brain-svc which calls the
  // selected LLM provider via litellm.
  app.post(
    "/api/admin-svc/ai/playground",
    { schema: adminSvcAiPlaygroundSchema, preHandler: requireAdmin },
    async (req, reply) => {
      const url = new URL("/api/brain/playground", BRAIN_URL);
      let res: Response;
      try {
        res = await fetch(url, {
          method: "POST",
          headers: {
            authorization: req.headers.authorization as string,
            "content-type": "application/json",
          },
          body: JSON.stringify(req.body ?? {}),
          signal: AbortSignal.timeout(60_000),
        });
      } catch (e: any) {
        req.log?.error({ err: e?.message }, "brain-svc playground proxy failed");
        return reply.status(502).send({ error: "Upstream brain-svc unavailable" });
      }
      reply.status(res.status as 200);
      const ct = res.headers.get("content-type");
      if (ct) reply.header("content-type", ct);
      return reply.send(await res.text());
    },
  );

  // ── Platform config (owned by admin-svc; append-only history) ──────
  app.get(
    "/api/admin-svc/config",
    { schema: getAdminSvcConfigSchema, preHandler: requireAdmin },
    async () => {
      const rows = await db
        .select()
        .from(platformConfig)
        .orderBy(desc(platformConfig.createdAt))
        .limit(1);
      if (rows.length > 0) return rows[0].config;
      return {
        features: {
          coLearning: true,
          homeworkHelper: true,
          sensoryProfiles: true,
          transitionPlanning: true,
          languageProfiles: true,
          dataExport: true,
        },
        limits: {
          maxLearnersPerTenant: 50,
          maxTutorSessionMinutes: 60,
          maxFileUploadMb: 10,
        },
      };
    },
  );

  app.put(
    "/api/admin-svc/config",
    { schema: updateAdminSvcConfigSchema, preHandler: requireAdmin },
    async (request) => {
      const { config, changeDescription } = request.body as any;
      const user = (request as any).user;

      await db.insert(platformConfig).values({
        config,
        changedBy: user.sub,
        changeDescription: changeDescription || null,
      });

      await logAuditEvent(db, {
        action: "CONFIG_UPDATED",
        actorId: user.sub,
        actorEmail: user.email || "",
        actorRole: user.role || "",
        resourceType: "platform_config",
        details: { config, changeDescription },
      });

      return { status: "updated", config };
    },
  );

  // Sprint 10 — append-only config history. Returns the last 200 rows
  // with author + timestamp + description so admins can audit when a
  // setting changed and who flipped it.
  app.get(
    "/api/admin-svc/config/history",
    { schema: getAdminSvcConfigHistorySchema, preHandler: requireAdmin },
    async () => {
      const rows = await db
        .select({
          id: platformConfig.id,
          config: platformConfig.config,
          changedBy: platformConfig.changedBy,
          changeDescription: platformConfig.changeDescription,
          createdAt: platformConfig.createdAt,
          actorEmail: users.email,
          actorName: users.name,
        })
        .from(platformConfig)
        .leftJoin(users, eq(platformConfig.changedBy, users.id))
        .orderBy(desc(platformConfig.createdAt))
        .limit(200);
      return { history: rows };
    },
  );
}
