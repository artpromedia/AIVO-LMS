/**
 * Sprint 1 (Enterprise Identity) — OIDC Relying-Party routes (per-tenant).
 *
 * AIVO consuming an EXTERNAL IdP (Okta / Entra / Google / Ping) via the
 * authorization-code + PKCE flow. This complements the SAML routes in
 * `routes/sso.ts` and the OIDC *provider* in `routes/oidc-provider.ts`.
 *
 *   GET /api/sso/oidc/:slug/login     — SP-initiated login (302 to IdP)
 *   GET /api/sso/oidc/:slug/callback  — authorization-code redirect handler
 *
 * Per-tenant RP config lives in `district_settings.sso_config.oidc`. JIT
 * provisioning is restricted to the same non-platform roles as SAML so a
 * misconfigured IdP can never mint a PLATFORM_ADMIN.
 */
import { FastifyInstance } from "fastify";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";
import { tenants, districtSettings, users, sessions } from "@aivo/db";
import { signJWT, verifyJWT } from "@aivo/security";
import { isInternalRole, refreshTtlMs, recordAdminLogin } from "../services/admin-session.js";
import { setSurfaceCookie } from "../lib/surface-cookie.js";
import { signAccessToken } from "../lib/jwt.js";
import {
  decryptOidcRpConfig,
  discoverOidc,
  newLoginParams,
  buildAuthorizeUrl,
  exchangeCode,
  validateIdToken,
  extractOidcEmail,
  extractOidcName,
  mapOidcRole,
  type OidcRpStoredConfig,
  type OidcRpConfig,
} from "../services/oidc-rp.js";

/** OIDC JIT provisioning is restricted to non-platform district roles. */
const OIDC_PROVISIONABLE_ROLES = new Set(["DISTRICT_ADMIN", "TEACHER", "CAREGIVER", "THERAPIST"]);

const TX_COOKIE = "oidc_rp_tx";
const TX_TTL = "10m";

interface OidcTxJWT {
  purpose: "oidc-rp-tx";
  slug: string;
  state: string;
  nonce: string;
  codeVerifier: string;
  returnTo: string;
}

function publicBaseUrl(req: any): string {
  const fromEnv = process.env.IDENTITY_PUBLIC_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const proto = (req.headers["x-forwarded-proto"] as string)?.split(",")[0] || "https";
  const host = (req.headers["x-forwarded-host"] || req.headers.host) as string;
  return `${proto}://${host}`;
}

function redirectUriFor(req: any, slug: string): string {
  return `${publicBaseUrl(req)}/api/sso/oidc/${encodeURIComponent(slug)}/callback`;
}

function hashRefreshToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function clientIp(req: any): string | null {
  return req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() || req.ip || null;
}

async function loadTenantOidcConfig(
  db: any,
  slug: string,
): Promise<{ tenant: any; config: OidcRpConfig } | null> {
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, slug)).limit(1);
  if (!tenant) return null;
  const [settings] = await db
    .select()
    .from(districtSettings)
    .where(eq(districtSettings.tenantId, tenant.id))
    .limit(1);
  if (!settings) return null;
  const stored = ((settings.ssoConfig || {}) as any).oidc as OidcRpStoredConfig | undefined;
  if (!stored || !stored.enabled || !stored.issuer || !stored.clientId) return null;
  return { tenant, config: decryptOidcRpConfig(stored) };
}

export async function registerOidcRpRoutes(app: FastifyInstance) {
  const db = (app as any).db;

  app.get(
    "/api/sso/oidc/:slug/login",
    {
      schema: {
        tags: ["SSO"],
        params: {
          type: "object",
          required: ["slug"],
          properties: { slug: { type: "string" } },
        },
        querystring: {
          type: "object",
          properties: { returnTo: { type: "string" } },
        },
      },
    },
    async (req, reply) => {
      const { slug } = req.params as { slug: string };
      const { returnTo } = req.query as { returnTo?: string };
      const loaded = await loadTenantOidcConfig(db, slug);
      if (!loaded) {
        return reply.status(404).send({ error: "OIDC not configured for this tenant" });
      }
      let authorizeUrl: string;
      let params: ReturnType<typeof newLoginParams>;
      try {
        const discovery = await discoverOidc(loaded.config);
        params = newLoginParams();
        authorizeUrl = buildAuthorizeUrl(
          discovery.authorization_endpoint,
          loaded.config,
          redirectUriFor(req, slug),
          params,
        );
      } catch (err: any) {
        req.log.error({ err: err.message, slug }, "OIDC login: discovery/build failed");
        return reply.status(502).send({ error: "Failed to initiate SSO" });
      }

      const tx: OidcTxJWT = {
        purpose: "oidc-rp-tx",
        slug,
        state: params.state,
        nonce: params.nonce,
        codeVerifier: params.codeVerifier,
        returnTo: returnTo || "/dashboard/district",
      };
      const txToken = await signJWT(tx, TX_TTL);
      reply.setCookie(TX_COOKIE, txToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/api/sso/oidc/",
        maxAge: 600,
      });
      return reply.redirect(authorizeUrl);
    },
  );

  app.get(
    "/api/sso/oidc/:slug/callback",
    {
      schema: {
        tags: ["SSO"],
        params: {
          type: "object",
          required: ["slug"],
          properties: { slug: { type: "string" } },
        },
        querystring: {
          type: "object",
          properties: {
            code: { type: "string" },
            state: { type: "string" },
            error: { type: "string" },
            error_description: { type: "string" },
          },
        },
      },
    },
    async (req, reply) => {
      const { slug } = req.params as { slug: string };
      const query = req.query as {
        code?: string;
        state?: string;
        error?: string;
        error_description?: string;
      };

      if (query.error) {
        req.log.warn({ slug, error: query.error }, "OIDC callback: IdP returned error");
        return reply.status(401).send({ error: "SSO sign-in was cancelled or failed" });
      }

      // Verify the signed transaction cookie (state + nonce + PKCE verifier).
      const rawTx = (req.cookies as any)?.[TX_COOKIE];
      if (!rawTx) return reply.status(400).send({ error: "Missing SSO transaction" });
      let tx: OidcTxJWT;
      try {
        tx = await verifyJWT<OidcTxJWT>(rawTx);
      } catch {
        return reply.status(400).send({ error: "Invalid or expired SSO transaction" });
      }
      reply.clearCookie(TX_COOKIE, { path: "/api/sso/oidc/" });

      if (tx.purpose !== "oidc-rp-tx" || tx.slug !== slug) {
        return reply.status(400).send({ error: "SSO transaction mismatch" });
      }
      if (!query.state || query.state !== tx.state) {
        req.log.warn({ slug }, "OIDC callback: state mismatch (possible CSRF)");
        return reply.status(400).send({ error: "SSO state mismatch" });
      }
      if (!query.code) return reply.status(400).send({ error: "Missing authorization code" });

      const loaded = await loadTenantOidcConfig(db, slug);
      if (!loaded) {
        return reply.status(404).send({ error: "OIDC not configured for this tenant" });
      }
      const { tenant, config } = loaded;

      let claims: any;
      try {
        const discovery = await discoverOidc(config);
        const tokens = await exchangeCode(
          discovery.token_endpoint,
          config,
          redirectUriFor(req, slug),
          query.code,
          tx.codeVerifier,
        );
        claims = await validateIdToken(tokens.id_token, discovery, config, tx.nonce);
      } catch (err: any) {
        req.log.warn({ err: err.message, slug }, "OIDC callback: token validation failed");
        return reply.status(401).send({ error: "Invalid SSO response" });
      }

      const email = extractOidcEmail(claims, config);
      if (!email) {
        return reply.status(400).send({ error: "OIDC response missing email claim" });
      }
      const name = extractOidcName(claims, config) || email.split("@")[0];
      const role = mapOidcRole(claims, config);
      if (!OIDC_PROVISIONABLE_ROLES.has(role)) {
        req.log.warn({ slug, email, role }, "OIDC JIT rejected: role not provisionable via SSO");
        return reply.status(403).send({
          error: "This account role cannot sign in via SSO. Contact your administrator.",
        });
      }

      const externalId = (typeof claims.sub === "string" && claims.sub) || email;

      // Find-or-provision, ALWAYS scoped by tenant (an IdP for tenant A must
      // never be able to assert an email that exists in tenant B).
      const [existing] = await db
        .select()
        .from(users)
        .where(and(eq(users.email, email), eq(users.tenantId, tenant.id)))
        .limit(1);
      let user: any = existing;
      if (!user) {
        const [collision] = await db
          .select({ id: users.id, tenantId: users.tenantId })
          .from(users)
          .where(eq(users.email, email))
          .limit(1);
        if (collision && collision.tenantId !== tenant.id) {
          req.log.warn(
            { slug, email, otherTenant: collision.tenantId },
            "OIDC JIT rejected: email belongs to a different tenant",
          );
          return reply.status(409).send({
            error:
              "This email is already registered with a different organization. Contact support.",
          });
        }
        const [created] = await db
          .insert(users)
          .values({
            tenantId: tenant.id,
            email,
            name,
            role,
            emailVerified: true,
            provisionedBy: "oidc",
            externalId,
          } as any)
          .returning();
        user = created;
      } else if (user.deactivatedAt) {
        return reply.status(403).send({ error: "Account has been deactivated. Contact support." });
      } else {
        await db
          .update(users)
          .set({
            lastLoginAt: new Date(),
            lastLoginIp: clientIp(req),
            provisionedBy: user.provisionedBy || "oidc",
            externalId: user.externalId || externalId,
          } as any)
          .where(eq(users.id, user.id));
      }

      // The federated session is cookie-based (refresh + surface cookies);
      // the web client exchanges the refresh cookie for an access token of
      // this shape. We mint it here so the `amr`/`acr` assurance convention
      // (federated single-factor => aal1) is established at the JIT site,
      // mirroring the SAML ACS flow.
      const accessToken = await signAccessToken({
        sub: user.id,
        tenantId: user.tenantId,
        role: user.role,
        email: user.email,
        name: user.name,
      });
      void accessToken;

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
      return reply.redirect(tx.returnTo || "/dashboard/district");
    },
  );
}
