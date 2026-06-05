/**
 * In-memory store of users' *additional* roles — the dev/mock fallback for
 * the platform-admin role-management UI (mirrors the messages/consent
 * dual-path). In production (`AIVO_USE_IDENTITY_SVC` / `AIVO_USE_SERVICE_STACK`
 * on + a real admin token) the BFF talks to identity-svc's
 * `/api/admin/users/:id/roles` instead. Process-local.
 *
 * Works in the web (lowercase) Role vocabulary; the identity-svc client
 * translates to/from the uppercase wire roles.
 */
const GRANTABLE = [
  "parent",
  "teacher",
  "caregiver",
  "therapist",
  "learner",
  "support",
  "marketing",
  "sales",
  "devops",
  "engineering",
];

const additional = new Map<string, Set<string>>();

export function isGrantableRole(role: string): boolean {
  return GRANTABLE.includes(role);
}

export function listAdditionalRoles(userId: string): string[] {
  return [...(additional.get(userId) ?? [])];
}

export function grantRole(userId: string, role: string): void {
  const set = additional.get(userId) ?? new Set<string>();
  set.add(role);
  additional.set(userId, set);
}

export function revokeRole(userId: string, role: string): void {
  additional.get(userId)?.delete(role);
}
