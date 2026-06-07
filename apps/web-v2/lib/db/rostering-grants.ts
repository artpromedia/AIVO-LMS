/**
 * Teacher rostering grants.
 *
 * Default-deny registry of which tenants have allowed their teachers to
 * connect/manage roster sources themselves. Teachers can never connect a
 * roster source unless their district has granted the right; admin roles
 * (school/district/platform) are not gated by this and may always
 * manage rostering for their tenant.
 *
 * In-memory singleton standing in for the source of truth: the district
 * setting `featureOverrides.teacherRosteringEnabled`, owned by
 * identity-svc and toggled by a district admin in the web-admin app
 * (see `@aivo/admin-api` `setDistrictRosteringGrant`). In
 * `AIVO_USE_IDENTITY_SVC` mode the grant is read from identity-svc; this
 * store backs the mock mode, same pattern as `sis-store`.
 */
import type { ID } from "@/lib/db/types";

declare global {
  var __aivoRosteringGrants: Set<ID> | undefined;
}

function granted(): Set<ID> {
  if (!globalThis.__aivoRosteringGrants) {
    globalThis.__aivoRosteringGrants = new Set<ID>();
  }
  return globalThis.__aivoRosteringGrants;
}

/** Whether the given tenant has granted teachers roster-connect rights. */
export function isTeacherRosteringGranted(tenantId: ID): boolean {
  return granted().has(tenantId);
}

/** Grant or revoke teacher roster-connect rights for a tenant. */
export function setTeacherRosteringGrant(tenantId: ID, value: boolean): boolean {
  const set = granted();
  if (value) set.add(tenantId);
  else set.delete(tenantId);
  return value;
}

/** Test helper — clears all grants. */
export function _resetRosteringGrants(): void {
  globalThis.__aivoRosteringGrants = undefined;
}
