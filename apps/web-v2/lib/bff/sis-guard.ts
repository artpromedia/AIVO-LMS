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
import { readMockSessionFromCookies } from "@/lib/auth/mock-session";
import type { SessionProfile } from "@/lib/auth/types";

type Ok = { session: SessionProfile; requestId: string };
type Err = { err: ReturnType<typeof fail> };

export async function requireSisViewer(req: Request): Promise<Ok | Err> {
  const requestId = getRequestId(req);
  const session = await readMockSessionFromCookies();
  if (!session)
    return { err: fail({ ...ERRORS.UNAUTHENTICATED, message: "No session cookie" }, requestId) };
  if (!["platform_admin", "district_admin", "school_admin"].includes(session.role)) {
    return { err: fail({ ...ERRORS.FORBIDDEN_ROLE, message: "admin role required" }, requestId) };
  }
  return { session, requestId };
}

export async function requireSisManager(req: Request): Promise<Ok | Err> {
  const requestId = getRequestId(req);
  const session = await readMockSessionFromCookies();
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
