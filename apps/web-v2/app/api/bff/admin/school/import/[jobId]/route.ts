import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { getImportJob } from "@/lib/admin/school-ops";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = ["school_admin", "district_admin", "platform_admin"] as const;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ jobId: string }> },
): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, [...ADMIN_ROLES], requestId);
    if (roleErr) return roleErr;

    const { jobId } = await params;
    const job = getImportJob(jobId);
    if (!job) {
      return fail({ ...ERRORS.NOT_FOUND, message: "Import job not found." }, requestId);
    }

    return ok({ job }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
