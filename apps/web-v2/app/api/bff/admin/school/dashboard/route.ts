/**
 * Sprint 7 — school admin dashboard BFF.
 *
 * Returns a single live snapshot for the `/admin/school` overview
 * page so the page can stop rendering hardcoded values. Restricted to
 * SCHOOL_ADMIN / DISTRICT_ADMIN / PLATFORM_ADMIN.
 */
import { NextResponse } from "next/server";
import { failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { ADMIN_ROLES, adminScopeForSession } from "@/lib/bff/admin-scope";
import { getSchoolDashboard } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, [...ADMIN_ROLES], requestId);
    if (roleErr) return roleErr;
    const scope = adminScopeForSession(session!);
    const tenantId = scope.tenantIds[0];
    if (!tenantId) {
      return ok(
        {
          snapshot: null,
          message: "No tenant in scope for this session.",
        },
        requestId,
      );
    }
    const url = new URL(req.url);
    const schoolId = url.searchParams.get("schoolId") ?? undefined;
    const snapshot = getSchoolDashboard(tenantId, schoolId);
    return ok({ snapshot }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
