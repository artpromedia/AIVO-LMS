import { NextResponse } from "next/server";
import { failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { listHumanReviewCases } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = ["school_admin", "district_admin", "platform_admin"] as const;

export async function GET(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, [...ADMIN_ROLES], requestId);
    if (roleErr) return roleErr;
    const tenantId = session!.role === "platform_admin" ? undefined : session!.tenantId;
    return ok({ cases: await listHumanReviewCases({ tenantId }) }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
