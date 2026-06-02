/**
 * Active-role hint (ADR 0020 — unified mobile shell).
 *
 * The unified app lets a multi-role user act as one role at a time. Every
 * authenticated request carries `x-aivo-active-role` so the server can shape
 * the response and audit the active role. It is NEVER a privilege grant — the
 * server validates it against the access token's role claims (see
 * `@aivo/security` `checkActiveRole`, enforced in family/learning/tutor/
 * billing/engagement-svc) and rejects a role the token doesn't grant.
 *
 * Today tokens are single-role, so the active role is just the signed-in
 * user's role (set from `useAuth`); once role-switching lands in the unified
 * shell, `RoleContext.setActiveRole` updates it too. Kept in a tiny
 * React-Native-free module so it stays unit-testable.
 */
export const ACTIVE_ROLE_HEADER = "x-aivo-active-role";

let activeRole: string | null = null;

export function setApiActiveRole(role: string | null): void {
  activeRole = role && role.trim().length > 0 ? role : null;
}

export function getApiActiveRole(): string | null {
  return activeRole;
}

/** Append the active-role header to a header bag when a role is set. */
export function applyActiveRoleHeader(headers: Record<string, string>): Record<string, string> {
  if (activeRole) headers[ACTIVE_ROLE_HEADER] = activeRole;
  return headers;
}
