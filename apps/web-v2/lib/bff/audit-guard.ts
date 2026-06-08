/**
 * RBAC + scope injection for the audit BFF (Sprint 3 matrix).
 *
 *   View global   : platform_admin
 *   View district : platform_admin, district_admin (own)
 *   View school   : platform_admin, district_admin (schools in district),
 *                   school_admin (own)
 *   Export        : all of the above; non-platform capped at 10k rows
 *   Hash-chain proof: platform_admin, district_admin (not school_admin)
 *
 * The scope is injected server-side so a client cannot widen its view by
 * tampering with query params.
 */
import { fail, getRequestId } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { getSession } from "@/lib/auth/session";
import type { SessionProfile } from "@/lib/auth/types";

export const SCHOOL_EXPORT_CAP = 10_000;

export type AuditScope = {
  /** Forced tenant filter (undefined = global, platform only). */
  tenantId?: string;
  /** Forced school filter (school_admin only). */
  schoolId?: string;
  canViewProof: boolean;
  exportCap: number | null; // null = uncapped (platform)
};

type Ok = { session: SessionProfile; requestId: string; scope: AuditScope };
type Err = { err: ReturnType<typeof fail> };

export async function requireAuditViewer(req: Request): Promise<Ok | Err> {
  const requestId = getRequestId(req);
  const session = await getSession();
  if (!session) {
    return { err: fail({ ...ERRORS.UNAUTHENTICATED, message: "No session cookie" }, requestId) };
  }
  let scope: AuditScope;
  switch (session.role) {
    case "platform_admin":
      scope = { canViewProof: true, exportCap: null };
      break;
    case "district_admin":
      scope = { tenantId: session.tenantId, canViewProof: true, exportCap: SCHOOL_EXPORT_CAP };
      break;
    case "school_admin":
      scope = { schoolId: session.tenantId, canViewProof: false, exportCap: SCHOOL_EXPORT_CAP };
      break;
    default:
      return { err: fail({ ...ERRORS.FORBIDDEN_ROLE, message: "admin role required" }, requestId) };
  }
  return { session, requestId, scope };
}
