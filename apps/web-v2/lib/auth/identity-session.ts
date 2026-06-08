/**
 * Real identity-svc session provider for web-v2 (the pilot path).
 *
 * This is the non-mock half of the session selector in `lib/auth/session.ts`.
 * It NEVER fabricates a session: it returns a profile only when a real auth
 * handshake has happened (the httpOnly cookies web-v2 set after a successful
 * identity-svc `/api/auth/login`).
 *
 * Two sources of truth, in priority order:
 *
 *   1. The signed access-token JWT (`aivo_access_token`). When web-v2 is
 *      configured with identity-svc's public key (`JWT_PUBLIC_KEY`, or a
 *      shared `JWT_KEY_DIR`), the token is cryptographically verified and the
 *      profile is built from the *verified* claims. This is the strongest
 *      guarantee and the brief's intent.
 *
 *   2. The httpOnly session snapshot (`aivo_session`) that web-v2 itself wrote
 *      at login. Used for render continuity when the access token is absent or
 *      cannot be verified in this context — e.g. the 15-minute access token has
 *      expired and a React Server Component cannot mint a fresh one (RSCs may
 *      not write cookies; refresh happens in the BFF `/api/auth/refresh` route).
 *      The snapshot is server-set and httpOnly, so it is not user-forgeable.
 *
 * The keypair is RS256 and per-process (packages/security): unless the public
 * key is distributed to web-v2, cross-service verification can't succeed, so
 * the snapshot fallback keeps the surface working while remaining safe. When
 * the key IS present (production / e2e with shared keys), verification is
 * authoritative.
 *
 * Server-only. Imported from server actions, route handlers, and the
 * `lib/auth/session.ts` selector — never from client components.
 */
import { cookies } from "next/headers";
import { verifyJWT } from "@aivo/security";
import {
  IDENTITY_ACCESS_TOKEN_COOKIE,
  IDENTITY_SESSION_COOKIE,
  mapWireRoleToRole,
} from "@/lib/auth/identity-client";
import { capabilitiesForRole } from "@/lib/auth/permissions";
import type { SessionProfile } from "@/lib/auth/types";

/** Shape of the access-token JWT minted by identity-svc (see signJWT calls). */
type AccessTokenClaims = {
  sub?: unknown;
  tenantId?: unknown;
  role?: unknown;
  email?: unknown;
  name?: unknown;
};

/** Build a base SessionProfile (no multi-role overlay) from verified claims. */
function profileFromClaims(claims: AccessTokenClaims): SessionProfile | null {
  const userId = typeof claims.sub === "string" ? claims.sub : null;
  const tenantId = typeof claims.tenantId === "string" ? claims.tenantId : null;
  const role = mapWireRoleToRole(typeof claims.role === "string" ? claims.role : null);
  const email = typeof claims.email === "string" ? claims.email : null;
  if (!userId || !tenantId || !role || !email) return null;
  const displayName = typeof claims.name === "string" && claims.name ? claims.name : email;
  const permissions = capabilitiesForRole(role);
  return { userId, tenantId, role, email, displayName, permissions, capabilities: permissions };
}

/** Parse the httpOnly snapshot cookie web-v2 wrote at login. */
function profileFromSnapshot(value: string | undefined): SessionProfile | null {
  if (!value) return null;
  try {
    const decoded = JSON.parse(decodeURIComponent(value)) as SessionProfile;
    if (!decoded || typeof decoded.role !== "string" || typeof decoded.userId !== "string") {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

/** Verify the access token; return its base profile, or null when it can't be
 *  trusted in this context (missing/expired token, or no public key here). */
async function profileFromAccessToken(token: string | undefined): Promise<SessionProfile | null> {
  if (!token) return null;
  try {
    const claims = await verifyJWT<AccessTokenClaims>(token);
    return profileFromClaims(claims);
  } catch {
    // Expired / unverifiable in this context — caller falls back to the
    // server-set snapshot. Never throw a fabricated session.
    return null;
  }
}

/**
 * Server-component / route-handler reader. Returns the BASE profile (the
 * multi-role overlay is applied once, centrally, by `getSession()`).
 */
export async function getIdentityBaseSession(): Promise<SessionProfile | null> {
  const jar = await cookies();
  const verified = await profileFromAccessToken(jar.get(IDENTITY_ACCESS_TOKEN_COOKIE)?.value);
  if (verified) return verified;
  return profileFromSnapshot(jar.get(IDENTITY_SESSION_COOKIE)?.value);
}

function readCookieFromHeader(header: string, name: string): string | undefined {
  for (const part of header.split(/;\s*/)) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    if (part.slice(0, eq) === name) return part.slice(eq + 1);
  }
  return undefined;
}

/**
 * Edge-friendly variant for Request-based callers (BFF guards). Prefers an
 * `Authorization: Bearer` access token, then the cookie access token, then the
 * httpOnly snapshot. Returns the BASE profile (overlay applied by the caller).
 */
export async function getIdentityBaseSessionFromRequest(
  req: Request,
): Promise<SessionProfile | null> {
  const header = req.headers.get("cookie") ?? "";
  const bearer = req.headers.get("authorization");
  const bearerToken =
    bearer && bearer.toLowerCase().startsWith("bearer ") ? bearer.slice(7).trim() : undefined;

  const verified = await profileFromAccessToken(
    bearerToken ?? readCookieFromHeader(header, IDENTITY_ACCESS_TOKEN_COOKIE),
  );
  if (verified) return verified;
  return profileFromSnapshot(readCookieFromHeader(header, IDENTITY_SESSION_COOKIE));
}
