/**
 * Sprint 9 — public, unauthenticated tenant branding endpoint.
 *
 * Lives under `/api/branding/*` (NOT `/api/district/*`) so it
 * intentionally bypasses the global tenant-scope hook. Returns only
 * presentation-safe fields — never SSO config, feature overrides, or
 * notification prefs. Used by parent + learner dashboards to theme
 * themselves on first paint without needing a session.
 *
 * Lookup is by tenant UUID. We don't have a slug column on the tenants
 * table in this schema, and the tenant id is already exposed to the
 * parent/learner clients via their session token, so using it as the
 * cache key here doesn't broaden the attack surface.
 */
import { FastifyInstance } from "fastify";
import { tenants, districtSettings } from "@aivo/db";
import { eq } from "drizzle-orm";
import { getBrandingPublicByTenantIdSchema } from "./schemas.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function registerPublicBrandingRoutes(app: FastifyInstance) {
  const db = (app as any).db;

  app.get("/api/branding/public/:tenantId", { schema: getBrandingPublicByTenantIdSchema }, async (req: any, reply: any) => {
    const { tenantId } = req.params as { tenantId: string };
    if (!tenantId || !UUID_RE.test(tenantId)) {
      return reply.status(404).send({ error: "Not found" });
    }
    const [tenant] = await db.select({ id: tenants.id, name: tenants.name })
      .from(tenants).where(eq(tenants.id, tenantId)).limit(1);
    if (!tenant) return reply.status(404).send({ error: "Not found" });
    const [settings] = await db.select({ branding: districtSettings.branding })
      .from(districtSettings).where(eq(districtSettings.tenantId, tenant.id)).limit(1);
    const b = ((settings?.branding as any) || {}) as any;
    // Cache aggressively — this is public and changes infrequently.
    reply.header("cache-control", "public, max-age=300");
    return {
      tenant: { id: tenant.id, name: tenant.name },
      branding: {
        displayName: b.displayName || tenant.name,
        primaryColor: b.primaryColor || null,
        logoUrl: b.logoUrl || null,
        supportEmail: b.supportEmail || null,
      },
    };
  });
}
