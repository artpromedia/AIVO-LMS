/**
 * Sprint 12.7 — minimal OpenID Connect Provider for AIVO.
 *
 * Exposes:
 *   GET  /.well-known/openid-configuration   — discovery document
 *   GET  /oidc/jwks.json                     — published JWK set
 *   GET  /oidc/authorize                     — auth-code flow with PKCE (S256)
 *   POST /oidc/token                         — code -> id/access token, refresh
 *   GET  /oidc/userinfo                      — bearer-token claims endpoint
 *
 * Signing keys are stored in `oidc_signing_keys` (migration 0044). At
 * startup we ensure at least one ACTIVE key exists; rotation is performed
 * by the daily housekeeping cron (out of scope here — `POST /oidc/rotate`
 * is exposed for the admin UI / operator).
 *
 * Scope is intentionally narrow: AIVO is the IdP only for internal Tools
 * and trusted partners. We do not yet support implicit, hybrid, or
 * client-credentials flows.
 *
 * Phase 2 (multi-replica): the auth-code / access-token / refresh-token
 * stores are now backed by Postgres (see services/oidc-store.ts), so grants
 * issued on one replica are redeemable on any other and survive rolling
 * deploys. Only hashes are persisted.
 */
import type { FastifyInstance } from "fastify";
import { eq, desc } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import * as jose from "jose";
import { oidcSigningKeys, users } from "@aivo/db";
import { OidcStore } from "../services/oidc-store.js";

const AUTH_CODE_TTL_MS = 60_000;
const ACCESS_TOKEN_TTL_MS = 3600_000;

function publicBaseUrl(req: any): string {
  if (process.env.OIDC_ISSUER) return process.env.OIDC_ISSUER.replace(/\/$/, "");
  if (process.env.IDENTITY_PUBLIC_URL) return process.env.IDENTITY_PUBLIC_URL.replace(/\/$/, "");
  const proto = (req.headers["x-forwarded-proto"] as string)?.split(",")[0] || "https";
  const host = (req.headers["x-forwarded-host"] || req.headers.host) as string;
  return `${proto}://${host}`;
}

async function ensureActiveSigningKey(db: any): Promise<{ kid: string; jwk: any }> {
  const [existing] = await db
    .select()
    .from(oidcSigningKeys)
    .where(eq(oidcSigningKeys.active, true))
    .orderBy(desc(oidcSigningKeys.createdAt))
    .limit(1);
  if (existing) return { kid: existing.kid, jwk: existing.jwk as any };
  const { publicKey, privateKey } = await jose.generateKeyPair("RS256", { extractable: true });
  const jwk = await jose.exportJWK(privateKey);
  const pubJwk = await jose.exportJWK(publicKey);
  const kid = `aivo-oidc-${Date.now()}`;
  (jwk as any).kid = kid;
  (jwk as any).use = "sig";
  (jwk as any).alg = "RS256";
  (pubJwk as any).kid = kid;
  (pubJwk as any).use = "sig";
  (pubJwk as any).alg = "RS256";
  await db.insert(oidcSigningKeys).values({
    kid,
    jwk: jwk as any,
    publicJwk: pubJwk as any,
    active: true,
  });
  return { kid, jwk: jwk as any };
}

function sha256b64url(input: string): string {
  return createHash("sha256").update(input).digest("base64url");
}

export async function registerOidcProviderRoutes(app: FastifyInstance) {
  const db = (app as any).db;
  const store = new OidcStore(db);

  // Discovery
  app.get("/.well-known/openid-configuration", async (req: any, reply) => {
    const issuer = publicBaseUrl(req);
    reply.send({
      issuer,
      authorization_endpoint: `${issuer}/oidc/authorize`,
      token_endpoint: `${issuer}/oidc/token`,
      userinfo_endpoint: `${issuer}/oidc/userinfo`,
      jwks_uri: `${issuer}/oidc/jwks.json`,
      response_types_supported: ["code"],
      subject_types_supported: ["public"],
      id_token_signing_alg_values_supported: ["RS256"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["client_secret_post", "none"],
      scopes_supported: ["openid", "email", "profile"],
      claims_supported: ["sub", "email", "email_verified", "name", "preferred_username", "role"],
    });
  });

  // JWKS — published from oidc_signing_keys (active + recently rotated keys).
  app.get("/oidc/jwks.json", async (_req, reply) => {
    const rows = await db
      .select()
      .from(oidcSigningKeys)
      .orderBy(desc(oidcSigningKeys.createdAt))
      .limit(5);
    const keys = rows.map((r: any) => r.publicJwk ?? r.jwk);
    reply.send({ keys });
  });

  // Authorize — auth-code + PKCE only.
  app.get("/oidc/authorize", async (req: any, reply) => {
    const q = (req.query ?? {}) as Record<string, string>;
    const {
      response_type,
      client_id,
      redirect_uri,
      scope = "openid",
      code_challenge,
      code_challenge_method,
      state,
      nonce,
    } = q;
    if (response_type !== "code") {
      return reply.code(400).send({ error: "unsupported_response_type" });
    }
    if (!client_id || !redirect_uri) {
      return reply.code(400).send({ error: "invalid_request" });
    }
    if (!code_challenge || code_challenge_method !== "S256") {
      return reply.code(400).send({ error: "invalid_request", error_description: "PKCE required" });
    }
    // We only authenticate users that already have a session cookie. If
    // none, redirect to the AIVO login UI with `next` set back to the
    // OIDC authorize URL so the browser returns here post-login.
    const sessionUserId = (req.cookies?.aivo_user_id as string | undefined) || null;
    if (!sessionUserId) {
      const next = encodeURIComponent(req.raw.url || "");
      return reply.redirect(`/login?next=${next}`);
    }
    const code = randomBytes(32).toString("base64url");
    await store.saveAuthCode(
      code,
      {
        clientId: client_id,
        redirectUri: redirect_uri,
        scope,
        userId: sessionUserId,
        codeChallenge: code_challenge,
        nonce,
      },
      AUTH_CODE_TTL_MS,
    );
    const sep = redirect_uri.includes("?") ? "&" : "?";
    const stateParam = state ? `&state=${encodeURIComponent(state)}` : "";
    return reply.redirect(`${redirect_uri}${sep}code=${encodeURIComponent(code)}${stateParam}`);
  });

  // Token
  app.post("/oidc/token", async (req: any, reply) => {
    const body = (req.body ?? {}) as Record<string, string>;
    const grantType = body.grant_type;
    const issuer = publicBaseUrl(req);
    const { kid, jwk } = await ensureActiveSigningKey(db);
    const privateKey = await jose.importJWK(jwk, "RS256");

    if (grantType === "authorization_code") {
      const rec = await store.takeAuthCode(body.code || "");
      if (!rec || rec.expired) {
        return reply.code(400).send({ error: "invalid_grant" });
      }
      if (rec.clientId !== body.client_id || rec.redirectUri !== body.redirect_uri) {
        return reply.code(400).send({ error: "invalid_grant" });
      }
      const expected = sha256b64url(body.code_verifier || "");
      if (expected !== rec.codeChallenge) {
        return reply.code(400).send({ error: "invalid_grant", error_description: "PKCE failure" });
      }
      const [user] = await db.select().from(users).where(eq(users.id, rec.userId)).limit(1);
      if (!user) return reply.code(400).send({ error: "invalid_grant" });
      const idToken = await new jose.SignJWT({
        email: user.email,
        email_verified: !!user.emailVerified,
        name: user.name,
        role: user.role,
        nonce: rec.nonce,
      })
        .setProtectedHeader({ alg: "RS256", kid, typ: "JWT" })
        .setIssuer(issuer)
        .setSubject(user.id)
        .setAudience(rec.clientId)
        .setIssuedAt()
        .setExpirationTime("1h")
        .sign(privateKey);
      const accessToken = randomBytes(32).toString("base64url");
      const refreshToken = randomBytes(32).toString("base64url");
      await store.saveAccessToken(
        accessToken,
        { userId: user.id, clientId: rec.clientId, scope: rec.scope },
        ACCESS_TOKEN_TTL_MS,
      );
      await store.saveRefreshToken(refreshToken, {
        userId: user.id,
        clientId: rec.clientId,
        scope: rec.scope,
      });
      return reply.send({
        access_token: accessToken,
        token_type: "Bearer",
        expires_in: 3600,
        refresh_token: refreshToken,
        id_token: idToken,
        scope: rec.scope,
      });
    }

    if (grantType === "refresh_token") {
      const rec = await store.getRefreshToken(body.refresh_token || "");
      if (!rec) return reply.code(400).send({ error: "invalid_grant" });
      const accessToken = randomBytes(32).toString("base64url");
      await store.saveAccessToken(
        accessToken,
        { userId: rec.userId, clientId: rec.clientId, scope: rec.scope },
        ACCESS_TOKEN_TTL_MS,
      );
      return reply.send({
        access_token: accessToken,
        token_type: "Bearer",
        expires_in: 3600,
        scope: rec.scope,
      });
    }

    return reply.code(400).send({ error: "unsupported_grant_type" });
  });

  // Userinfo
  app.get("/oidc/userinfo", async (req: any, reply) => {
    const auth = req.headers.authorization as string | undefined;
    if (!auth?.startsWith("Bearer ")) {
      reply.header("WWW-Authenticate", "Bearer");
      return reply.code(401).send({ error: "invalid_token" });
    }
    const token = auth.slice(7);
    const rec = await store.getAccessToken(token);
    if (!rec) {
      return reply.code(401).send({ error: "invalid_token" });
    }
    const [user] = await db.select().from(users).where(eq(users.id, rec.userId)).limit(1);
    if (!user) return reply.code(401).send({ error: "invalid_token" });
    return reply.send({
      sub: user.id,
      email: user.email,
      email_verified: !!user.emailVerified,
      name: user.name,
      preferred_username: user.email,
      role: user.role,
    });
  });

  // Admin-only rotate. Marks the current active key as rotated_at = now()
  // and generates a fresh one. JWKS continues to publish the old key for
  // five rotations so existing tokens remain verifiable.
  app.post("/oidc/rotate", async (req: any, reply) => {
    // Reuse the existing admin-IP allowlist + step-up auth gates by
    // exposing this only through the admin router in a follow-up. For
    // now require the INTERNAL_SERVICE_TOKEN to avoid public rotation.
    if (req.headers["x-service-token"] !== process.env.INTERNAL_SERVICE_TOKEN) {
      return reply.code(401).send({ error: "unauthorized" });
    }
    await db
      .update(oidcSigningKeys)
      .set({ active: false, rotatedAt: new Date() })
      .where(eq(oidcSigningKeys.active, true));
    const fresh = await ensureActiveSigningKey(db);
    reply.send({ ok: true, kid: fresh.kid });
  });
}
