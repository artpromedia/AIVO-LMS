/**
 * RBAC guard for the SIS roster-sync BFF (Sprint 2 matrix):
 *
 *   Action                   platform_admin  district_admin  school_admin
 *   Configure connector      yes             yes (own)       no
 *   Trigger manual sync      yes             yes (own)       no
 *   View status / errors     yes             yes (own)       yes (read-only)
 *
 * `requireSisManager` gates mutations (configure/trigger/retry);
 * `requireSisViewer` gates reads (adds school_admin). Tenant scoping for
 * mutations is enforced via `authorizeManageTenant`.
 */
import { fail, getRequestId } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { getSession } from "@/lib/auth/session";
import { isTeacherRosteringGranted } from "@/lib/db/rostering-grants";
import { fetchTeacherRosteringGrant } from "@/lib/bff/service-clients/rostering";
import type { SessionProfile } from "@/lib/auth/types";

type Ok = { session: SessionProfile; requestId: string };
type Err = { err: ReturnType<typeof fail> };

export async function requireSisViewer(req: Request): Promise<Ok | Err> {
  const requestId = getRequestId(req);
  const session = await getSession();
  if (!session)
    return { err: fail({ ...ERRORS.UNAUTHENTICATED, message: "No session cookie" }, requestId) };
  if (!["platform_admin", "district_admin", "school_admin"].includes(session.role)) {
    return { err: fail({ ...ERRORS.FORBIDDEN_ROLE, message: "admin role required" }, requestId) };
  }
  return { session, requestId };
}

export async function requireSisManager(req: Request): Promise<Ok | Err> {
  const requestId = getRequestId(req);
  const session = await getSession();
  if (!session)
    return { err: fail({ ...ERRORS.UNAUTHENTICATED, message: "No session cookie" }, requestId) };
  if (session.role !== "platform_admin" && session.role !== "district_admin") {
    return {
      err: fail(
        { ...ERRORS.FORBIDDEN_ROLE, message: "platform_admin or district_admin required" },
        requestId,
      ),
    };
  }
  return { session, requestId };
}

/** Mutations: platform_admin any tenant; district_admin own tenant only. */
export function authorizeManageTenant(
  session: SessionProfile,
  tenantId: string,
  requestId: string,
): ReturnType<typeof fail> | null {
  if (session.role === "platform_admin") return null;
  if (session.role === "district_admin" && session.tenantId === tenantId) return null;
  return fail(
    { ...ERRORS.FORBIDDEN_TENANT, message: "Not permitted to manage this district's SIS" },
    requestId,
  );
}

/**
 * Teacher rostering surface guard.
 *
 * Per the "full connect parity" product decision, teachers may
 * configure and trigger roster connectors — but only ever for their own
 * tenant (school/district). Admin roles are also accepted so they can
 * use the same surface. Tenant scoping is enforced separately via
 * {@link authorizeRosterTenant}; every action on this surface is bounded
 * to `session.tenantId` for non-platform roles.
 *
 * SECURITY NOTE: this intentionally broadens the historically
 * admin-only SIS connect/sync capability (see `requireSisManager`) to
 * the teacher role. SIS providers carry district-wide PII, so this
 * surface keeps strict tenant scoping and should be revisited in a
 * dedicated security review before enabling district SIS providers for
 * teachers in production.
 */
const ROSTERING_ROLES: ReadonlyArray<SessionProfile["role"]> = [
  "teacher",
  "school_admin",
  "district_admin",
  "platform_admin",
];

export async function requireRosteringActor(req: Request): Promise<Ok | Err> {
  const requestId = getRequestId(req);
  const session = await getSession();
  if (!session)
    return { err: fail({ ...ERRORS.UNAUTHENTICATED, message: "No session cookie" }, requestId) };
  if (!ROSTERING_ROLES.includes(session.role)) {
    return {
      err: fail({ ...ERRORS.FORBIDDEN_ROLE, message: "rostering role required" }, requestId),
    };
  }
  return { session, requestId };
}

/**
 * The tenant a rostering action targets. Non-platform roles are always
 * pinned to their own tenant; platform_admin may target any tenant via
 * the supplied id (falling back to their session tenant).
 */
export function resolveRosterTenant(session: SessionProfile, requestedTenantId?: string): string {
  if (session.role === "platform_admin" && requestedTenantId) return requestedTenantId;
  return session.tenantId;
}

/** Connectors a rostering actor may touch must live in their own tenant. */
export function authorizeRosterTenant(
  session: SessionProfile,
  tenantId: string,
  requestId: string,
): ReturnType<typeof fail> | null {
  if (session.role === "platform_admin") return null;
  if (session.tenantId === tenantId) return null;
  return fail(
    { ...ERRORS.FORBIDDEN_TENANT, message: "Not permitted to manage this tenant's roster" },
    requestId,
  );
}

/**
 * Whether this actor may CONNECT / sync / disconnect roster sources for
 * the tenant. Admin roles always may (they are the district). Teachers
 * may only when the district has granted the right (default-deny).
 *
 * In `AIVO_USE_IDENTITY_SVC` mode the grant is read live from
 * identity-svc (the district setting set by the web-admin app); on any
 * read failure, and in mock mode, it falls back to the in-memory store.
 */
export async function canConnectRoster(
  session: SessionProfile,
  tenantId: string,
): Promise<boolean> {
  if (session.role !== "teacher") return true;
  if (process.env.AIVO_USE_IDENTITY_SVC === "true") {
    const granted = await fetchTeacherRosteringGrant();
    if (granted !== null) return granted;
  }
  return isTeacherRosteringGranted(tenantId);
}

/**
 * Gate roster mutations on the district grant. Returns a 403 failure
 * when a teacher's district has not enabled teacher-managed rostering,
 * otherwise `null`.
 */
export async function requireRosterConnectGrant(
  session: SessionProfile,
  tenantId: string,
  requestId: string,
): Promise<ReturnType<typeof fail> | null> {
  if (await canConnectRoster(session, tenantId)) return null;
  return fail(
    {
      ...ERRORS.FORBIDDEN_ROLE,
      message: "Teacher roster connections are not enabled for this district",
      userMessage:
        "Your district hasn't enabled teacher-managed roster connections. Ask your school or district admin to turn it on.",
    },
    requestId,
  );
}
