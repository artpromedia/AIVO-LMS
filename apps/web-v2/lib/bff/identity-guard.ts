/**
 * Shared RBAC guard for the Enterprise Identity BFF routes, enforcing the
 * Sprint 1 matrix:
 *
 *   Action                         platform_admin  district_admin  school_admin
 *   Configure IdP (any tenant)     yes             no              no
 *   Configure IdP (own district)   yes             yes (own only)  no
 *   Issue SCIM token               yes             yes (own only)  no
 *
 * platform_admin may act on any tenant; district_admin is constrained to
 * its own tenant; school_admin (and everyone else) is denied.
 */
import { fail, getRequestId } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { getSession } from "@/lib/auth/session";
import type { SessionProfile } from "@/lib/auth/types";

export type IdentityGuardOk = { session: SessionProfile; requestId: string };
export type IdentityGuardErr = { err: ReturnType<typeof fail> };

/** Require an authenticated platform_admin or district_admin. */
export async function requireIdentityAdmin(
  req: Request,
): Promise<IdentityGuardOk | IdentityGuardErr> {
  const requestId = getRequestId(req);
  const session = await getSession();
  if (!session) {
    return { err: fail({ ...ERRORS.UNAUTHENTICATED, message: "No session cookie" }, requestId) };
  }
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

/**
 * Authorize an action against a specific tenant. platform_admin passes for
 * any tenant; district_admin only for its own. Returns an error response on
 * denial, or `null` when authorized.
 */
export function authorizeTenant(
  session: SessionProfile,
  tenantId: string,
  requestId: string,
): ReturnType<typeof fail> | null {
  if (session.role === "platform_admin") return null;
  if (session.role === "district_admin" && session.tenantId === tenantId) return null;
  return fail(
    { ...ERRORS.FORBIDDEN_TENANT, message: "Not permitted to manage this tenant's identity" },
    requestId,
  );
}
