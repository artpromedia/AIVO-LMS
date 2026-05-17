import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { getMigrationJob, listMigrationRecords } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ jobId: string }> };

export async function GET(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { jobId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["platform_admin"], requestId);
    if (roleErr) return roleErr;
    const job = getMigrationJob(jobId);
    if (!job) return fail({ ...ERRORS.NOT_FOUND, message: "Job not found." }, requestId);
    return ok({ job, records: listMigrationRecords(jobId) }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
