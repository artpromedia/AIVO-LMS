import { NextResponse } from "next/server";
import { getRequestId } from "@/lib/bff/response";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { handleDeleteCurriculum } from "@/lib/bff/curriculum";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ learnerId: string; uploadId: string }> };

/** DELETE /api/bff/teacher/learners/:learnerId/curriculum/:uploadId */
export async function DELETE(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId, uploadId } = await params;
  const { session, response } = await requireSession(req, requestId);
  if (response) return response;
  const roleErr = requireRole(session!, ["teacher", "school_admin", "district_admin"], requestId);
  if (roleErr) return roleErr;
  return handleDeleteCurriculum(req, requestId, session!, learnerId, uploadId);
}
