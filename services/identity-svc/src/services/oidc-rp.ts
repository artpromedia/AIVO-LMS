/**
 * Sprint 1 (Enterprise Identity) — OIDC Relying-Party (RP) flow.
 *
 * This is the *client* side of OpenID Connect: AIVO consuming an external
 * IdP (Okta, Microsoft Entra ID, Google Workspace, Ping). It complements
 * `routes/oidc-provider.ts`, which is the *provider* side (AIVO acting as an
 * IdP for internal tools).
 *
 * Authorization-code flow with PKCE (S256) and a signed, stateless
 * transaction cookie that carries `state` (CSRF) and `nonce` (id_token
 * replay) so no server-side session store is needed for the handshake.
 *
 * Per-tenant RP configuration is stored alongside the SAML config in
 * `district_settings.sso_config.oidc`. The client secret is held as an
 * encrypted envelope (`v1:iv:tag:ct`) and decrypted on demand, mirroring
 * how `@aivo/sso` handles the SAML signing material — so we add no new
 * migration and reuse the existing at-rest encryption.
 */
import { createHash, randomBytes } from "node:crypto";
import * as jose from "jose";
import { decryptSecret } from "@aivo/security";

/** Stored shape of `district_settings.sso_config.oidc`. */
export interface OidcRpStoredConfig {
  enabled: boolean;
  /** Friendly label rendered on the login page ("Continue with Okta"). */
  idpLabel?: string;
  /** OIDC issuer (must match the `iss` claim in the id_token). */
  issuer: string;
  /** Explicit discovery document URL; defaults to issuer + well-known path. */
  discoveryUrl?: string;
  clientId: string;
  /** Encrypted client secret envelope (`v1:iv:tag:ct`). */
  clientSecretEnvelope?: string;
  /** Requested scopes. `openid` is always included. */
  scopes?: string[];
  /** id_token / userinfo claim carrying the email. Default `email`. */
  emailClaim?: string;
  /** Claim carrying the display name. Default `name`. */
  nameClaim?: string;
  /** Claim carrying the role/group value(s). Default `roles`. */
  roleClaim?: string;
  /** Map from IdP role/group values to AIVO roles. */
  roleMap?: Record<string, string>;
  /** AIVO role assigned when no role claim maps. Default `TEACHER`. */
  defaultRole?: string;
  /** Email domains owned by this tenant (drives `/api/auth/discover`). */
  emailDomains?: string[];
}

/** Runtime config with the client secret decrypted. */
export interface OidcRpConfig extends Omit<OidcRpStoredConfig, "clientSecretEnvelope"> {
  clientSecret?: string;
}

export function decryptOidcRpConfig(stored: OidcRpStoredConfig): OidcRpConfig {
  const { clientSecretEnvelope, ...rest } = stored;
  const out: OidcRpConfig = { ...rest };
  if (clientSecretEnvelope) out.clientSecret = decryptSecret(clientSecretEnvelope);
  return out;
}

/** OIDC discovery document fields we rely on. */
export interface OidcDiscovery {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  userinfo_endpoint?: string;
}

const DISCOVERY_PATH = "/.well-known/openid-configuration";
const discoveryCache = new Map<string, { doc: OidcDiscovery; fetchedAt: number }>();
const DISCOVERY_TTL_MS = 10 * 60 * 1000;

export function discoveryUrlFor(cfg: Pick<OidcRpConfig, "issuer" | "discoveryUrl">): string {
  if (cfg.discoveryUrl) return cfg.discoveryUrl;
  return cfg.issuer.replace(/\/$/, "") + DISCOVERY_PATH;
}

/** Fetch (and cache) the IdP discovery document. */
export async function discoverOidc(
  cfg: Pick<OidcRpConfig, "issuer" | "discoveryUrl">,
  fetchImpl: typeof fetch = fetch,
): Promise<OidcDiscovery> {
  const url = discoveryUrlFor(cfg);
  const cached = discoveryCache.get(url);
  if (cached && Date.now() - cached.fetchedAt < DISCOVERY_TTL_MS) return cached.doc;
  const res = await fetchImpl(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`OIDC discovery failed: ${res.status}`);
  const doc = (await res.json()) as OidcDiscovery;
  if (!doc.authorization_endpoint || !doc.token_endpoint || !doc.jwks_uri) {
    throw new Error("OIDC discovery document missing required endpoints");
  }
  discoveryCache.set(url, { doc, fetchedAt: Date.now() });
  return doc;
}

/** Test seam — drop a discovery doc into the cache (used by unit tests). */
export function _seedDiscovery(url: string, doc: OidcDiscovery): void {
  discoveryCache.set(url, { doc, fetchedAt: Date.now() });
}
export function _resetDiscoveryCache(): void {
  discoveryCache.clear();
}

/** PKCE S256 code challenge for a given verifier. */
export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export interface OidcLoginParams {
  state: string;
  nonce: string;
  codeVerifier: string;
}

/** Mint the random transaction parameters for an authorization request. */
export function newLoginParams(): OidcLoginParams {
  return {
    state: randomBytes(16).toString("base64url"),
    nonce: randomBytes(16).toString("base64url"),
    codeVerifier: randomBytes(32).toString("base64url"),
  };
}

/** Build the IdP authorization-endpoint redirect URL. */
export function buildAuthorizeUrl(
  authorizationEndpoint: string,
  cfg: OidcRpConfig,
  redirectUri: string,
  params: OidcLoginParams,
): string {
  const scopes = new Set(["openid", ...(cfg.scopes ?? ["email", "profile"])]);
  const url = new URL(authorizationEndpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", cfg.clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", [...scopes].join(" "));
  url.searchParams.set("state", params.state);
  url.searchParams.set("nonce", params.nonce);
  url.searchParams.set("code_challenge", pkceChallenge(params.codeVerifier));
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export interface OidcTokenResponse {
  id_token: string;
  access_token?: string;
  token_type?: string;
  expires_in?: number;
}

/** Exchange an authorization code for tokens at the IdP token endpoint. */
export async function exchangeCode(
  tokenEndpoint: string,
  cfg: OidcRpConfig,
  redirectUri: string,
  code: string,
  codeVerifier: string,
  fetchImpl: typeof fetch = fetch,
): Promise<OidcTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: cfg.clientId,
    code_verifier: codeVerifier,
  });
  const headers: Record<string, string> = {
    "content-type": "application/x-www-form-urlencoded",
    accept: "application/json",
  };
  // Confidential clients authenticate with HTTP Basic; public clients rely
  // on PKCE alone (no secret configured).
  if (cfg.clientSecret) {
    const basic = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64");
    headers.authorization = `Basic ${basic}`;
  }
  const res = await fetchImpl(tokenEndpoint, { method: "POST", headers, body });
  if (!res.ok) throw new Error(`OIDC token exchange failed: ${res.status}`);
  const json = (await res.json()) as OidcTokenResponse;
  if (!json.id_token) throw new Error("OIDC token response missing id_token");
  return json;
}

/**
 * Verify the id_token signature against the IdP JWKS and validate the
 * issuer, audience, expiry and nonce. Returns the verified claims.
 */
export async function validateIdToken(
  idToken: string,
  discovery: OidcDiscovery,
  cfg: OidcRpConfig,
  expectedNonce: string,
  jwks?: jose.JWTVerifyGetKey,
): Promise<jose.JWTPayload> {
  const keySet = jwks ?? jose.createRemoteJWKSet(new URL(discovery.jwks_uri));
  const { payload } = await jose.jwtVerify(idToken, keySet, {
    issuer: discovery.issuer,
    audience: cfg.clientId,
  });
  if (!payload.nonce || payload.nonce !== expectedNonce) {
    throw new Error("OIDC id_token nonce mismatch");
  }
  return payload;
}

export function extractOidcEmail(claims: jose.JWTPayload, cfg: OidcRpConfig): string | null {
  const v = claims[cfg.emailClaim || "email"] ?? claims.email;
  return typeof v === "string" && v.includes("@") ? v.toLowerCase() : null;
}

export function extractOidcName(claims: jose.JWTPayload, cfg: OidcRpConfig): string | null {
  const v = claims[cfg.nameClaim || "name"] ?? claims.name;
  return typeof v === "string" && v.length ? v : null;
}

/**
 * Map the IdP role/group claim to an AIVO role via `roleMap`, falling back
 * to `defaultRole` (TEACHER). The role claim may be a string or an array of
 * strings (groups); the first mapped value wins.
 */
export function mapOidcRole(claims: jose.JWTPayload, cfg: OidcRpConfig): string {
  const raw = claims[cfg.roleClaim || "roles"] ?? claims.roles ?? claims.role;
  const values: string[] = Array.isArray(raw)
    ? raw.filter((x): x is string => typeof x === "string")
    : typeof raw === "string"
      ? [raw]
      : [];
  const map = cfg.roleMap || {};
  for (const v of values) {
    if (map[v]) return map[v];
  }
  return cfg.defaultRole || "TEACHER";
}
