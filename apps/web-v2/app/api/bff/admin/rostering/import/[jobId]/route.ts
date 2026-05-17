import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { getRosterImportJob, getRosterImportJobAny, listRosterImportErrors } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ jobId: string }> };

const ADMIN_ROLES = ["school_admin", "district_admin", "platform_admin"] as const;

export async function GET(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { jobId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, [...ADMIN_ROLES], requestId);
    if (roleErr) return roleErr;
    const job =
      session!.role === "platform_admin"
        ? getRosterImportJobAny(jobId)
        : getRosterImportJob(jobId, session!.tenantId);
    if (!job) {
      return fail({ ...ERRORS.NOT_FOUND, message: "Import job not found." }, requestId);
    }
    const errors = listRosterImportErrors(jobId);
    return ok({ job, errors }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
