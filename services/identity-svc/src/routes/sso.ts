/**
 * Sprint 6: SAML 2.0 SSO routes (per-tenant).
 *
 * Endpoints:
 *   GET  /api/sso/saml/:slug/metadata       — SP metadata XML for IdP setup
 *   GET  /api/sso/saml/:slug/login          — Initiate SP-initiated login (302)
 *   POST /api/sso/saml/:slug/acs            — Assertion consumer (HTTP-POST)
 *   GET  /api/sso/saml/:slug/slo            — Single-logout (HTTP-Redirect)
 *   POST /api/sso/saml/:slug/slo            — Single-logout (HTTP-POST)
 *   POST /api/auth/discover                  — Resolve email -> { mode, ssoLoginUrl }
 *
 * The IdP cert and SP private key are stored encrypted in
 * `district_settings.sso_config` and decrypted on demand by `@aivo/sso`.
 *
 * PLATFORM_ADMIN logins NEVER go through district SSO — the break-glass
 * password+MFA path lives in /api/auth/admin-login. SAML JIT here can only
 * provision DISTRICT_ADMIN, TEACHER, CAREGIVER, THERAPIST.
 */

import { FastifyInstance } from "fastify";
import { eq, and, sql } from "drizzle-orm";
import crypto from "crypto";
import { tenants, districtSettings, users, sessions } from "@aivo/db";
import { signJWT } from "@aivo/security";
import {
  decryptSsoConfig,
  buildSaml,
  extractEmail,
  extractName,
  mapRole,
  type StoredSsoConfig,
  type DecryptedSsoConfig,
} from "@aivo/sso";
import { isInternalRole, refreshTtlMs, recordAdminLogin } from "../services/admin-session.js";
import { setSurfaceCookie } from "../lib/surface-cookie.js";
import {
  getSsoSamlBySlugMetadataSchema,
  getSsoSamlBySlugLoginSchema,
  ssoSamlBySlugAcsSchema,
  getSsoSamlBySlugSloSchema,
  ssoSamlBySlugSloSchema,
} from "./schemas.js";

/** SAML JIT provisioning is restricted to non-platform district roles. */
const SAML_PROVISIONABLE_ROLES = new Set(["DISTRICT_ADMIN", "TEACHER", "CAREGIVER", "THERAPIST"]);

function publicBaseUrl(req: any): string {
  const fromEnv = process.env.IDENTITY_PUBLIC_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const proto = (req.headers["x-forwarded-proto"] as string)?.split(",")[0] || "https";
  const host = (req.headers["x-forwarded-host"] || req.headers.host) as string;
  return `${proto}://${host}`;
}

function hashRefreshToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function clientIp(req: any): string | null {
  return req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() || req.ip || null;
}

async function loadTenantConfig(
  db: any,
  slug: string,
): Promise<{ tenant: any; config: DecryptedSsoConfig } | null> {
  // `slug` is the tenant UUID — we don't have a separate slug column yet
  // and adding one is out of scope for this sprint.
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, slug)).limit(1);
  if (!tenant) return null;
  const [settings] = await db
    .select()
    .from(districtSettings)
    .where(eq(districtSettings.tenantId, tenant.id))
    .limit(1);
  if (!settings) return null;
  const stored = (settings.ssoConfig || {}) as StoredSsoConfig;
  if (!stored.enabled || !stored.entryPoint) return null;
  return { tenant, config: decryptSsoConfig(stored) };
}

export async function registerSsoRoutes(app: FastifyInstance) {
  const db = (app as any).db;

  /**
   * Email-domain discovery. Public, unauthenticated. Returns `mode: "sso"`
   * iff some tenant has SSO enabled with a matching domain. Used by the
   * district login page to render the right form. Never reveals whether a
   * specific account exists.
   */
  app.post(
    "/api/auth/discover",
    {
      schema: {
        tags: ["Auth"],
        body: {
          type: "object",
          required: ["email"],
          properties: { email: { type: "string", format: "email" } },
        },
      },
    },
    async (req, _reply) => {
      const { email } = req.body as { email: string };
      const domain = email.toLowerCase().split("@")[1];
      if (!domain) return { mode: "password" as const };

      // Scan all enabled SSO configs whose emailDomains include this domain.
      // For modest tenant counts this is fine; index later if it grows.
      const rows = await db
        .select({
          tenantId: districtSettings.tenantId,
          ssoConfig: districtSettings.ssoConfig,
        })
        .from(districtSettings)
        .where(sql`(${districtSettings.ssoConfig}->>'enabled')::boolean = true`);

      for (const row of rows) {
        const cfg = (row.ssoConfig || {}) as StoredSsoConfig;
        const domains = (cfg.emailDomains || []).map((d) => d.toLowerCase());
        if (!domains.includes(domain)) continue;
        return {
          mode: "sso" as const,
          ssoLoginUrl: `/api/sso/saml/${encodeURIComponent(row.tenantId)}/login`,
          idpLabel: cfg.idpLabel || "SSO",
          requireSso: !!cfg.requireSso,
        };
      }
      return { mode: "password" as const };
    },
  );

  app.get(
    "/api/sso/saml/:slug/metadata",
    { schema: getSsoSamlBySlugMetadataSchema },
    async (req, reply) => {
      const { slug } = req.params as { slug: string };
      const loaded = await loadTenantConfig(db, slug);
      if (!loaded) return reply.status(404).send({ error: "SSO not configured for this tenant" });
      const saml = buildSaml({
        publicBaseUrl: publicBaseUrl(req),
        tenantSlug: slug,
        config: loaded.config,
      });
      const xml = saml.generateServiceProviderMetadata(null, loaded.config.idpCert ?? null);
      reply.header("Content-Type", "application/xml");
      return xml;
    },
  );

  app.get(
    "/api/sso/saml/:slug/login",
    { schema: getSsoSamlBySlugLoginSchema },
    async (req, reply) => {
      const { slug } = req.params as { slug: string };
      const { returnTo } = req.query as { returnTo?: string };
      const loaded = await loadTenantConfig(db, slug);
      if (!loaded) return reply.status(404).send({ error: "SSO not configured for this tenant" });
      const saml = buildSaml({
        publicBaseUrl: publicBaseUrl(req),
        tenantSlug: slug,
        config: loaded.config,
      });
      try {
        const url = await saml.getAuthorizeUrlAsync(
          returnTo || "/dashboard/district",
          req.headers.host || "",
          {},
        );
        reply.redirect(url);
      } catch (err: any) {
        req.log.error({ err: err.message, slug }, "saml getAuthorizeUrl failed");
        return reply.status(502).send({ error: "Failed to initiate SSO" });
      }
    },
  );

  app.post("/api/sso/saml/:slug/acs", { schema: ssoSamlBySlugAcsSchema }, async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const loaded = await loadTenantConfig(db, slug);
    if (!loaded) return reply.status(404).send({ error: "SSO not configured for this tenant" });
    const { tenant, config } = loaded;

    const saml = buildSaml({
      publicBaseUrl: publicBaseUrl(req),
      tenantSlug: slug,
      config,
    });

    let profile: any;
    try {
      const result = await saml.validatePostResponseAsync(req.body as any);
      profile = result.profile;
      if (!profile) throw new Error("empty SAML profile");
    } catch (err: any) {
      req.log.warn({ err: err.message, slug }, "SAML ACS validation failed");
      return reply.status(401).send({ error: "Invalid SAML response" });
    }

    const email = extractEmail(profile, config);
    if (!email) {
      return reply.status(400).send({ error: "SAML response missing email attribute" });
    }
    const name = extractName(profile, config) || email.split("@")[0];
    let role = mapRole(profile, config);

    // Sprint 12.7 — narrowly permit PLATFORM_ADMIN via SAML when:
    //   1. the IdP asserts a signed `platform-admin` attribute (the
    //      assertion-level signature has already been validated by
    //      validatePostResponseAsync above), AND
    //   2. the target tenant is the platform tenant.
    // Otherwise PLATFORM_ADMIN must never be assigned through SSO —
    // strip it down to the existing restricted set so a misconfigured
    // role-attribute mapping can't escalate.
    const isPlatformTenant =
      tenant.id === process.env.AIVO_PLATFORM_TENANT_ID ||
      tenant.slug === "platform" ||
      tenant.kind === "platform";
    const platformAdminAttr =
      profile?.attributes?.["platform-admin"] ??
      profile?.attributes?.platformAdmin ??
      profile?.["platform-admin"];
    const platformAdminAsserted =
      platformAdminAttr === true || platformAdminAttr === "true" || platformAdminAttr === "1";
    if (role === "PLATFORM_ADMIN") {
      if (!(isPlatformTenant && platformAdminAsserted)) {
        req.log.warn(
          { slug, email, isPlatformTenant, platformAdminAsserted },
          "SAML JIT: PLATFORM_ADMIN role assertion rejected; downgrading to DISTRICT_ADMIN",
        );
        role = "DISTRICT_ADMIN";
      }
    }

    if (role !== "PLATFORM_ADMIN" && !SAML_PROVISIONABLE_ROLES.has(role)) {
      req.log.warn({ slug, email, role }, "SAML JIT rejected: role not provisionable via SSO");
      return reply.status(403).send({
        error: "This account role cannot sign in via SSO. Contact your administrator.",
      });
    }

    const externalId = (profile.nameID as string) || email;

    // Find-or-provision — ALWAYS scope by tenant. Looking up by email
    // alone would let a malicious IdP for tenant A assert an email that
    // happens to exist in tenant B and receive that user's session.
    const [existing] = await db
      .select()
      .from(users)
      .where(and(eq(users.email, email), eq(users.tenantId, tenant.id)))
      .limit(1);
    let user: any = existing;
    if (!user) {
      // Defense in depth: refuse if the email is already provisioned in
      // any *other* tenant. Cross-tenant email collisions need an admin
      // to resolve manually rather than auto-provisioning a duplicate.
      const [collision] = await db
        .select({ id: users.id, tenantId: users.tenantId })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      if (collision && collision.tenantId !== tenant.id) {
        req.log.warn(
          { slug, email, otherTenant: collision.tenantId },
          "SAML JIT rejected: email belongs to a different tenant",
        );
        return reply.status(409).send({
          error: "This email is already registered with a different organization. Contact support.",
        });
      }
    }
    if (!user) {
      const [created] = await db
        .insert(users)
        .values({
          tenantId: tenant.id,
          email,
          name,
          role,
          emailVerified: true,
          provisionedBy: "saml",
          externalId,
        } as any)
        .returning();
      user = created;
    } else if (user.deactivatedAt) {
      return reply.status(403).send({ error: "Account has been deactivated. Contact support." });
    } else {
      // Refresh last-login + provisioning marker so the audit shows SAML.
      await db
        .update(users)
        .set({
          lastLoginAt: new Date(),
          lastLoginIp: clientIp(req),
          provisionedBy: user.provisionedBy || "saml",
          externalId: user.externalId || externalId,
        } as any)
        .where(eq(users.id, user.id));
    }

    const accessToken = await signJWT({
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
      name: user.name,
    });

    const rawRefreshToken = crypto.randomUUID();
    const ttlMs = refreshTtlMs(user.role);
    const hashedRT = hashRefreshToken(rawRefreshToken);
    await db.insert(sessions).values({
      userId: user.id,
      refreshToken: hashedRT,
      expiresAt: new Date(Date.now() + ttlMs),
    });
    if (isInternalRole(user.role)) {
      await recordAdminLogin(db, user.id, hashedRT, req.headers as any, clientIp(req));
    }

    reply.setCookie("refreshToken", rawRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: Math.floor(ttlMs / 1000),
    });
    await setSurfaceCookie(reply, user.role);

    // RelayState carries the original returnTo target (we passed it into
    // getAuthorizeUrlAsync as the `RelayState`). node-saml puts it on the
    // result as `RelayState` when present.
    const body = req.body as any;
    const returnTo = (body?.RelayState as string) || "/dashboard/district";
    return reply.redirect(returnTo);
  });

  // SLO accepts both bindings.
  const sloHandler = async (req: any, reply: any) => {
    const { slug } = req.params as { slug: string };
    const loaded = await loadTenantConfig(db, slug);
    if (!loaded) return reply.status(404).send({ error: "SSO not configured for this tenant" });
    const saml = buildSaml({
      publicBaseUrl: publicBaseUrl(req),
      tenantSlug: slug,
      config: loaded.config,
    });
    try {
      // Accept either binding; node-saml exposes both validators.
      if (req.method === "POST") {
        await saml.validatePostRequestAsync(req.body as any);
      } else {
        await saml.validateRedirectAsync(
          req.query as any,
          (req.raw.url as string).split("?")[1] || "",
        );
      }
    } catch (err: any) {
      req.log.warn({ err: err.message, slug }, "SAML SLO validation failed");
    }
    reply.clearCookie("refreshToken", { path: "/" });
    reply.redirect("/district/login");
  };
  app.get("/api/sso/saml/:slug/slo", { schema: getSsoSamlBySlugSloSchema }, sloHandler);
  app.post("/api/sso/saml/:slug/slo", { schema: ssoSamlBySlugSloSchema }, sloHandler);
}
