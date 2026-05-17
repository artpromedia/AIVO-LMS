import { NextResponse } from "next/server";
import { failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { ADMIN_ROLES, adminScopeForSession } from "@/lib/bff/admin-scope";
import { computeSystemHealth, listAiGenerationJobs } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, [...ADMIN_ROLES], requestId);
    if (roleErr) return roleErr;
    const scope = adminScopeForSession(session!);
    const jobs = listAiGenerationJobs(scope.tenantIds, 200);
    const health = computeSystemHealth(scope.tenantIds);
    return ok({ jobs, summary: health }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
