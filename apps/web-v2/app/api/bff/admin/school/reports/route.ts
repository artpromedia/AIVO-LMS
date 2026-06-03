import { NextResponse } from "next/server";
import { failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { REPORT_CATALOG } from "@/lib/admin/school-ops";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = ["school_admin", "district_admin", "platform_admin"] as const;

export async function GET(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, [...ADMIN_ROLES], requestId);
    if (roleErr) return roleErr;

    return ok({ catalog: REPORT_CATALOG }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
