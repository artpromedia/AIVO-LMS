/**
 * Edge-verifiable surface role cookie.
 *
 * The web middleware needs to know which role is logged in *before* SSR so
 * it can enforce surface separation (admin vs district vs consumer hosts).
 * The httpOnly `refreshToken` is opaque (DB-backed), so identity-svc issues
 * a second short-lived signed cookie alongside it whose value is
 * `<role>.<expEpochSeconds>.<base64url(hmac-sha256)>`. The middleware
 * verifies the HMAC with the same shared secret and reads `<role>` directly,
 * with no network round-trip.
 *
 * Both sides MUST agree on the secret (`SURFACE_COOKIE_SECRET`, falling back
 * to `JWT_SECRET`, falling back to a clearly-marked dev value).
 *
 * This module is pure (no fastify, no Node-only crypto). The Node-side uses
 * a thin wrapper that calls `node:crypto`; the Edge-side (Next.js
 * middleware) uses Web Crypto SubtleCrypto. Both produce identical bytes.
 */

export const SURFACE_COOKIE_NAME = "aivo_session_role";

export interface SurfaceCookieClaims {
  role: string;
  exp: number;
}

export function getSurfaceSecret(env: NodeJS.ProcessEnv = process.env): string {
  const secret = env.SURFACE_COOKIE_SECRET || env.JWT_SECRET;
  if (!secret) {
    if (env.NODE_ENV === "production") {
      throw new Error("SURFACE_COOKIE_SECRET (or JWT_SECRET) must be set in production");
    }
    return "dev-only-surface-cookie-secret-do-not-use-in-prod";
  }
  return secret;
}

export function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return (typeof btoa !== "undefined" ? btoa(bin) : Buffer.from(bin, "binary").toString("base64"))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function constantTimeEqualStrings(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacSha256(secret: string, message: string): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return new Uint8Array(sig);
}

export async function signSurfaceCookieValue(
  role: string,
  ttlSeconds = 30 * 24 * 60 * 60,
  secret: string = getSurfaceSecret(),
): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${role}.${exp}`;
  const sig = await hmacSha256(secret, payload);
  return `${payload}.${b64urlEncode(sig)}`;
}

export async function verifySurfaceCookieValue(
  value: string | undefined,
  secret: string = getSurfaceSecret(),
): Promise<SurfaceCookieClaims | null> {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [role, expStr, sig] = parts;
  if (!role || !expStr || !sig) return null;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp <= 0) return null;
  if (exp < Math.floor(Date.now() / 1000)) return null;
  const expected = b64urlEncode(await hmacSha256(secret, `${role}.${exp}`));
  if (!constantTimeEqualStrings(sig, expected)) return null;
  return { role, exp };
}
