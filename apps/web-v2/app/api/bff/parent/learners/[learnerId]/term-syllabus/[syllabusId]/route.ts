import { NextResponse } from "next/server";
import { getRequestId } from "@/lib/bff/response";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { handleDeleteTermSyllabus } from "@/lib/bff/term-syllabus";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ learnerId: string; syllabusId: string }> };

/** DELETE /api/bff/parent/learners/:learnerId/term-syllabus/:syllabusId */
export async function DELETE(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId, syllabusId } = await params;
  const { session, response } = await requireSession(req, requestId);
  if (response) return response;
  const roleErr = requireRole(session!, ["parent", "caregiver"], requestId);
  if (roleErr) return roleErr;
  return handleDeleteTermSyllabus(req, requestId, session!, learnerId, syllabusId);
}
