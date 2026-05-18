/**
 * Identity-svc wrapper around the shared @aivo/security surface-cookie
 * helpers. The underlying HMAC logic is shared with the web edge middleware
 * (apps/web/src/middleware.ts) so both sides agree on the wire format.
 *
 * Exposed: setSurfaceCookie / clearSurfaceCookie convenience helpers that
 * speak fastify's reply cookie API. Re-exports the cookie name and the
 * pure sign/verify helpers for unit tests and other call-sites.
 */
import type { FastifyReply } from "fastify";
import { SURFACE_COOKIE_NAME, signSurfaceCookieValue } from "@aivo/security";

export {
  SURFACE_COOKIE_NAME,
  signSurfaceCookieValue,
  verifySurfaceCookieValue,
  getSurfaceSecret,
} from "@aivo/security";

const TTL_SECONDS = 30 * 24 * 60 * 60;

export async function setSurfaceCookie(reply: FastifyReply, role: string): Promise<void> {
  const value = await signSurfaceCookieValue(role, TTL_SECONDS);
  reply.setCookie(SURFACE_COOKIE_NAME, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TTL_SECONDS,
  });
}

export function clearSurfaceCookie(reply: FastifyReply): void {
  reply.clearCookie(SURFACE_COOKIE_NAME, { path: "/" });
}
