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
    opts?.availableRoles && opts.availableRoles.length > 0
      ? opts.availableRoles
      : [grantedRole];
  const granted = grantedList.map(normalize);
  if (granted.includes(requested)) {
    return { ok: true, activeRole: requested };
  }
  return { ok: false, code: FORBIDDEN_ROLE_CODE, requested, granted };
}
