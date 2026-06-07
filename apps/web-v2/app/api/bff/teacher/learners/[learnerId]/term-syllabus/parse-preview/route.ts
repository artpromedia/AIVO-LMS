import { NextResponse } from "next/server";
import { getRequestId } from "@/lib/bff/response";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { handleParseTermPreview } from "@/lib/bff/term-syllabus";

export const dynamic = "force-dynamic";

const TEACHER_ROLES = ["teacher", "school_admin", "district_admin"] as const;

type Params = { params: Promise<{ learnerId: string }> };

/** POST /api/bff/teacher/learners/:learnerId/term-syllabus/parse-preview */
export async function POST(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId } = await params;
  const { session, response } = await requireSession(req, requestId);
  if (response) return response;
  const roleErr = requireRole(session!, [...TEACHER_ROLES], requestId);
  if (roleErr) return roleErr;
  return handleParseTermPreview(req, requestId, session!, learnerId);
}
