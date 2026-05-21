/**
 * Shared helpers for writing the three auth cookies on the web-v2 domain.
 *
 *   - aivo_access_token  : short-lived JWT (15m) used by BFF routes as
 *                          the bearer credential against identity-svc.
 *   - aivo_refresh_token : opaque refresh token (30d) used by the
 *                          /api/auth/refresh BFF route to mint new
 *                          access tokens.
 *   - aivo_session       : URI-encoded JSON snapshot of the
 *                          SessionProfile so server components can read
 *                          the session without round-tripping to
 *                          identity-svc on every render.
 *
 * Kept in a separate module so login, MFA-verify, and refresh share one
 * code path — drift between those three is how subtle session bugs
 * sneak in.
 */
import type { SessionProfile } from "./types";
import {
  IDENTITY_ACCESS_TOKEN_COOKIE,
  IDENTITY_REFRESH_TOKEN_COOKIE,
  IDENTITY_SESSION_COOKIE,
} from "./identity-client";

const ACCESS_TOKEN_MAX_AGE_SECONDS = 60 * 15; // 15 minutes
const REFRESH_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

type CookieJar = {
  set: (name: string, value: string, options: Record<string, unknown>) => void;
  delete?: (name: string) => void;
};

function baseOptions() {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

/**
 * Write the access-token cookie. Used by both login (initial mint) and
 * /api/auth/refresh (rotation).
 */
export function setAccessTokenCookie(jar: CookieJar, accessToken: string) {
  jar.set(IDENTITY_ACCESS_TOKEN_COOKIE, accessToken, {
    ...baseOptions(),
    maxAge: ACCESS_TOKEN_MAX_AGE_SECONDS,
  });
}

/**
 * Write the refresh-token cookie. Caller passes the raw refresh token
 * extracted from identity-svc's Set-Cookie (we strip the identity-svc
 * Domain/Path attributes and re-issue under the web-v2 origin).
 */
export function setRefreshTokenCookie(jar: CookieJar, refreshToken: string) {
  jar.set(IDENTITY_REFRESH_TOKEN_COOKIE, refreshToken, {
    ...baseOptions(),
    maxAge: REFRESH_TOKEN_MAX_AGE_SECONDS,
  });
}

/**
 * Write the session-profile snapshot cookie. Stored as URI-encoded JSON
 * because cookie values must be 7-bit clean and the profile may contain
 * non-ASCII characters (e.g. accented display names).
 */
export function setSessionCookie(jar: CookieJar, profile: SessionProfile) {
  jar.set(IDENTITY_SESSION_COOKIE, encodeURIComponent(JSON.stringify(profile)), {
    ...baseOptions(),
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

/**
 * Write all three cookies in one shot. Used by login + verify-mfa.
 */
export function setAuthSessionCookies(
  jar: CookieJar,
  args: {
    accessToken: string;
    refreshToken: string | null;
    profile: SessionProfile;
  },
) {
  setAccessTokenCookie(jar, args.accessToken);
  if (args.refreshToken) {
    setRefreshTokenCookie(jar, args.refreshToken);
  }
  setSessionCookie(jar, args.profile);
}

/**
 * Clear every cookie this module manages. Used by logout + 401 from
 * refresh.
 */
export function clearAuthSessionCookies(jar: CookieJar) {
  const opts = { ...baseOptions(), maxAge: 0 };
  jar.set(IDENTITY_ACCESS_TOKEN_COOKIE, "", opts);
  jar.set(IDENTITY_REFRESH_TOKEN_COOKIE, "", opts);
  jar.set(IDENTITY_SESSION_COOKIE, "", opts);
}
