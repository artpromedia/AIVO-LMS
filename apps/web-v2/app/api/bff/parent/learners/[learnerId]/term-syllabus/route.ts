import { NextResponse } from "next/server";
import { getRequestId } from "@/lib/bff/response";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { handleListTermSyllabi, handleSaveTermSyllabus } from "@/lib/bff/term-syllabus";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ learnerId: string }> };

/** GET /api/bff/parent/learners/:learnerId/term-syllabus */
export async function GET(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId } = await params;
  const { session, response } = await requireSession(req, requestId);
  if (response) return response;
  const roleErr = requireRole(session!, ["parent", "caregiver"], requestId);
  if (roleErr) return roleErr;
  return handleListTermSyllabi(req, requestId, session!, learnerId);
}

/** POST /api/bff/parent/learners/:learnerId/term-syllabus */
export async function POST(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId } = await params;
  const { session, response } = await requireSession(req, requestId);
  if (response) return response;
  const roleErr = requireRole(session!, ["parent", "caregiver"], requestId);
  if (roleErr) return roleErr;
  return handleSaveTermSyllabus(req, requestId, session!, learnerId);
}
