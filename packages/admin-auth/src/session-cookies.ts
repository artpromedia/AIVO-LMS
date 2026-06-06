import type { SessionProfile } from "./types.js";
import {
  IDENTITY_ACCESS_TOKEN_COOKIE,
  IDENTITY_REFRESH_TOKEN_COOKIE,
  IDENTITY_SESSION_COOKIE,
} from "./identity-client.js";

const ACCESS_TOKEN_MAX_AGE_SECONDS = 60 * 15;
const REFRESH_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

type CookieJar = {
  set: (name: string, value: string, options: Record<string, unknown>) => void;
};

function baseOptions() {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(process.env.SESSION_COOKIE_DOMAIN ? { domain: process.env.SESSION_COOKIE_DOMAIN } : {}),
  };
}

export function setAccessTokenCookie(jar: CookieJar, accessToken: string) {
  jar.set(IDENTITY_ACCESS_TOKEN_COOKIE, accessToken, {
    ...baseOptions(),
    maxAge: ACCESS_TOKEN_MAX_AGE_SECONDS,
  });
}

export function setRefreshTokenCookie(jar: CookieJar, refreshToken: string) {
  jar.set(IDENTITY_REFRESH_TOKEN_COOKIE, refreshToken, {
    ...baseOptions(),
    maxAge: REFRESH_TOKEN_MAX_AGE_SECONDS,
  });
}

export function setSessionCookie(jar: CookieJar, profile: SessionProfile) {
  jar.set(IDENTITY_SESSION_COOKIE, encodeURIComponent(JSON.stringify(profile)), {
    ...baseOptions(),
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export function setAuthSessionCookies(
  jar: CookieJar,
  args: {
    accessToken: string;
    refreshToken: string | null;
    profile: SessionProfile;
  },
) {
  setAccessTokenCookie(jar, args.accessToken);
  if (args.refreshToken) setRefreshTokenCookie(jar, args.refreshToken);
  setSessionCookie(jar, args.profile);
}

export function clearAuthSessionCookies(jar: CookieJar) {
  const opts = { ...baseOptions(), maxAge: 0 };
  jar.set(IDENTITY_ACCESS_TOKEN_COOKIE, "", opts);
  jar.set(IDENTITY_REFRESH_TOKEN_COOKIE, "", opts);
  jar.set(IDENTITY_SESSION_COOKIE, "", opts);
}
