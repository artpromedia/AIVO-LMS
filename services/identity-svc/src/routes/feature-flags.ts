/**
 * Sprint B2 — tenant-scoped feature flags.
 *
 *   GET   /api/users/me/flags                       — resolved flags for the
 *         caller's tenant (kill > tenant override > env default). Consumed
 *         by web-v2's BFF and the mobile app; anonymous-tenant callers get
 *         env defaults.
 *   GET   /api/admin/tenants/:tenantId/flags        — platform-admin view:
 *         per-flag default/override/effective triple for the admin UI.
 *   PATCH /api/admin/tenants/:tenantId/flags/:flag  — set or clear one
 *         override ({ enabled: boolean | null }). Audited via the tenant
 *         activity log; the resolver cache is invalidated immediately.
 *
 * Overrides live in `district_settings.feature_overrides` — the SAME jsonb
 * identity-svc already consults for `forceMfa`, so there is exactly one
 * per-tenant override store.
 */
import { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { districtSettings, districtActivityLog, appendAudit } from "@aivo/db";
import {
  createTenantFlagResolver,
  isValidFlagKey,
  killSwitchEnvVar,
  resolveEnterpriseFlags,
  ENTERPRISE_FLAG_ENV_VARS,
  readBooleanFromSource,
  type EnterpriseFlagKey,
  type TenantOverrides,
} from "@aivo/feature-flags";
import { requirePlatformAdmin } from "./admin.js";
import { verifyJWT } from "@aivo/security";

/** Bearer-token guard (same shape as routes/users.ts). */
async function authenticate(req: any, reply: any) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return reply.status(401).send({ error: "Missing authorization header" });
  }
  try {
    req.user = await verifyJWT(auth.slice(7));
  } catch {
    return reply.status(401).send({ error: "Invalid token" });
  }
}

const passthrough = { type: "object", additionalProperties: true, properties: {} } as const;

export async function registerFeatureFlagRoutes(app: FastifyInstance) {
  const db = (app as any).db;

  async function loadOverrides(tenantId: string): Promise<TenantOverrides> {
    const [settings] = await db
      .select({ featureOverrides: districtSettings.featureOverrides })
      .from(districtSettings)
      .where(eq(districtSettings.tenantId, tenantId))
      .limit(1);
    const raw = (settings?.featureOverrides || {}) as Record<string, unknown>;
    const out: TenantOverrides = {};
    for (const [key, value] of Object.entries(raw)) {
      if (isValidFlagKey(key) && typeof value === "boolean") out[key] = value;
    }
    return out;
  }

  const resolver = createTenantFlagResolver({ loadOverrides });

  app.get(
    "/api/users/me/flags",
    {
      schema: { tags: ["FeatureFlags"], security: [{ bearerAuth: [] }], response: { 200: passthrough } },
      preHandler: authenticate,
    },
    async (req: any) => {
      const tenantId: string | null = req.user?.tenantId ?? null;
      const flags = await resolver.resolveForTenant(tenantId);
      return { tenantId, flags };
    },
  );

  app.get(
    "/api/admin/tenants/:tenantId/flags",
    {
      schema: { tags: ["FeatureFlags"], security: [{ bearerAuth: [] }], response: { 200: passthrough } },
      preHandler: requirePlatformAdmin,
    },
    async (req: any) => {
      const { tenantId } = req.params as { tenantId: string };
      const defaults = resolveEnterpriseFlags();
      const overrides = await loadOverrides(tenantId);
      const env = process.env as Record<string, string | undefined>;
      const rows = (Object.keys(ENTERPRISE_FLAG_ENV_VARS) as EnterpriseFlagKey[]).map((key) => {
        const killed = readBooleanFromSource(env, killSwitchEnvVar(key), false);
        const override = overrides[key];
        const effective = killed ? false : typeof override === "boolean" ? override : defaults[key];
        return {
          key,
          envVar: ENTERPRISE_FLAG_ENV_VARS[key],
          default: defaults[key],
          override: typeof override === "boolean" ? override : null,
          killed,
          effective,
        };
      });
      return { tenantId, flags: rows };
    },
  );

  app.patch(
    "/api/admin/tenants/:tenantId/flags/:flagKey",
    {
      schema: {
        tags: ["FeatureFlags"],
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["enabled"],
          additionalProperties: false,
          properties: { enabled: { type: ["boolean", "null"] } },
        },
        response: { 200: passthrough, 400: passthrough },
      },
      preHandler: requirePlatformAdmin,
    },
    async (req: any, reply: any) => {
      const { tenantId, flagKey } = req.params as { tenantId: string; flagKey: string };
      const { enabled } = req.body as { enabled: boolean | null };
      if (!isValidFlagKey(flagKey)) {
        return reply.status(400).send({ error: `Unknown feature flag "${flagKey}"` });
      }

      const [existing] = await db
        .select()
        .from(districtSettings)
        .where(eq(districtSettings.tenantId, tenantId))
        .limit(1);
      const prior = (existing?.featureOverrides || {}) as Record<string, unknown>;
      const next: Record<string, unknown> = { ...prior };
      const before = typeof prior[flagKey] === "boolean" ? prior[flagKey] : null;
      if (enabled === null) delete next[flagKey];
      else next[flagKey] = enabled;

      if (existing) {
        await db
          .update(districtSettings)
          .set({ featureOverrides: next, updatedAt: new Date() })
          .where(eq(districtSettings.tenantId, tenantId));
      } else {
        await db.insert(districtSettings).values({ tenantId, featureOverrides: next });
      }

      // Audit trail in the tenant's hash-chained activity feed — the same
      // chain the district verifier walks (Sprint B4 consumes this).
      await appendAudit(db, "district_activity_log", districtActivityLog, {
        tenantId,
        action: "feature_flag.override_changed",
        actorId: req.user?.sub ?? "platform",
        actorName: req.user?.email ?? null,
        onBehalfOfId: null,
        resourceType: "feature_flag",
        resourceId: flagKey,
        details: { before, after: enabled },
      }).catch(() => {
        // best-effort: never block the toggle on the audit insert
      });

      resolver.invalidate(tenantId);
      return { tenantId, flagKey, override: enabled };
    },
  );
}
