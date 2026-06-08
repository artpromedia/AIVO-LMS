import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { getDataDeletionRequest, getDataDeletionRequestById } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ requestId: string }> };

export async function GET(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { requestId: id } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["parent", "platform_admin"], requestId);
    if (roleErr) return roleErr;
    const rec = await (
      session!.role === "platform_admin"
        ? getDataDeletionRequestById(id)
        : getDataDeletionRequest(id, session!.tenantId));
    if (!rec) return fail({ ...ERRORS.NOT_FOUND, message: "Request not found." }, requestId);
    if (session!.role === "parent" && rec.parentUserId !== session!.userId) {
      return fail({ ...ERRORS.NOT_FOUND, message: "Request not found." }, requestId);
    }
    return ok({ request: rec }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
