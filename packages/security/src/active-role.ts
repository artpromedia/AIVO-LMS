/**
 * Active-role header validation (ADR 0020 — single shell, multi-role).
 *
 * The unified mobile app sends `x-aivo-active-role: <role>` on every
 * authenticated request as a HINT for response shaping and audit. It is
 * NEVER a privilege grant: the server validates it against the roles the
 * caller's token actually grants and rejects a mismatch as a spoof
 * attempt (the "Sprint 09 follow-up" enforcement that the unified-app
 * contract specified but that had never landed).
 *
 * Tokens today carry a single `role`, so the granted set defaults to
 * `[role]` — which means a normal single-role caller (whose app sends
 * its own role) always passes. Pass `availableRoles` once tokens list
 * multiple roles and the check widens automatically with no caller
 * changes.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { verifyJWT } from "./index.js";

export const ACTIVE_ROLE_HEADER = "x-aivo-active-role";
export const FORBIDDEN_ROLE_CODE = "FORBIDDEN_ROLE";
/** Structured-log / audit event name emitted on a rejected header. */
export const ACTIVE_ROLE_SPOOFING_EVENT = "auth.active_role.spoofing";

export type ActiveRoleResult =
  | { ok: true; activeRole: string | null }
  | { ok: false; code: typeof FORBIDDEN_ROLE_CODE; requested: string; granted: readonly string[] };

function normalize(role: string): string {
  return role.trim().toLowerCase();
}

/**
 * Validate an `x-aivo-active-role` header value against the roles a token
 * grants.
 *
 * - Header absent → `{ ok: true, activeRole: null }` (the hint is
 *   optional; no enforcement).
 * - Header names a granted role → `{ ok: true, activeRole }`.
 * - Header names a role the token does not grant → `{ ok: false,
 *   code: "FORBIDDEN_ROLE", ... }` — the caller should reject with 403
 *   and audit-log {@link ACTIVE_ROLE_SPOOFING_EVENT}.
 */
export function checkActiveRole(
  grantedRole: string,
  headerValue: string | string[] | undefined | null,
  opts?: { availableRoles?: readonly string[] },
): ActiveRoleResult {
  const raw = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  if (raw === undefined || raw === null || raw === "") {
    return { ok: true, activeRole: null };
  }
  const requested = normalize(raw);
  const grantedList =
    opts?.availableRoles && opts.availableRoles.length > 0 ? opts.availableRoles : [grantedRole];
  const granted = grantedList.map(normalize);
  if (granted.includes(requested)) {
    return { ok: true, activeRole: requested };
  }
  return { ok: false, code: FORBIDDEN_ROLE_CODE, requested, granted };
}

/** Extract a bearer JWT from the Authorization header or `access_token` cookie. */
function extractBearer(req: FastifyRequest): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) return authHeader.slice(7);
  const cookieHeader = req.headers.cookie;
  if (typeof cookieHeader === "string") {
    const match = cookieHeader.match(/access_token=([^;]+)/);
    if (match) return match[1];
  }
  return null;
}

/**
 * Register a global `onRequest` hook that enforces the `x-aivo-active-role`
 * header against the caller's token (ADR 0020 — single shell, multi-role).
 *
 * The header is a HINT, never a privilege grant. This hook only does work
 * when the header is actually present (the unified mobile app sends it on
 * every authenticated request; web and internal service-token callers do
 * not), so it is a no-op for the common path:
 *
 *  - Header absent ⇒ return (nothing to enforce).
 *  - Header present but no user JWT (missing/invalid token, or a service-token
 *    call) ⇒ return; the route's own auth still applies (we never add a new
 *    authentication requirement here, only reject spoofed role hints).
 *  - Header names a role the token grants ⇒ continue.
 *  - Header names a role the token does NOT grant ⇒ audit-log
 *    {@link ACTIVE_ROLE_SPOOFING_EVENT} and reject with 403.
 *
 * Safe by construction: a real single-role caller sends its own role and
 * always passes; only a client claiming a role its token doesn't grant is
 * rejected. Skips OPTIONS / health / docs probes.
 */
export function registerActiveRoleHook(app: FastifyInstance): void {
  app.addHook("onRequest", async (req: FastifyRequest, reply: FastifyReply) => {
    const headerValue = req.headers[ACTIVE_ROLE_HEADER];
    if (headerValue === undefined || headerValue === null || headerValue === "") {
      return; // hint absent — nothing to enforce (web, internal calls)
    }

    const url = req.url || "";
    if (
      req.method === "OPTIONS" ||
      url === "/" ||
      url.startsWith("/health") ||
      url.startsWith("/docs") ||
      url.startsWith("/json")
    ) {
      return;
    }

    const token = extractBearer(req);
    if (!token) return; // no user token — let the route's own auth respond

    let payload: { sub?: string; role?: string; tenantId?: string; availableRoles?: string[] };
    try {
      payload = await verifyJWT(token);
    } catch {
      return; // invalid token — the route's own auth will reject it
    }

    const result = checkActiveRole(payload.role || "", headerValue, {
      availableRoles: payload.availableRoles,
    });
    if (!result.ok) {
      req.log?.warn?.(
        {
          event: ACTIVE_ROLE_SPOOFING_EVENT,
          userId: payload.sub,
          tenantId: payload.tenantId,
          requested: result.requested,
          granted: result.granted,
        },
        "rejected x-aivo-active-role header (token does not grant the requested role)",
      );
      reply.code(403).send({ error: "Forbidden role", code: FORBIDDEN_ROLE_CODE });
    }
  });
}
