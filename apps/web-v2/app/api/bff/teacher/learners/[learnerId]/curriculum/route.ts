import { NextResponse } from "next/server";
import { getRequestId } from "@/lib/bff/response";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { handleListCurriculum, handleUpload } from "@/lib/bff/curriculum";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ learnerId: string }> };

const TEACHER_ROLES = ["teacher", "school_admin", "district_admin"] as const;

/** GET /api/bff/teacher/learners/:learnerId/curriculum */
export async function GET(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId } = await params;
  const { session, response } = await requireSession(req, requestId);
  if (response) return response;
  const roleErr = requireRole(session!, [...TEACHER_ROLES], requestId);
  if (roleErr) return roleErr;
  return handleListCurriculum(req, requestId, session!, learnerId);
}

/** POST /api/bff/teacher/learners/:learnerId/curriculum */
export async function POST(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId } = await params;
  const { session, response } = await requireSession(req, requestId);
  if (response) return response;
  const roleErr = requireRole(session!, [...TEACHER_ROLES], requestId);
  if (roleErr) return roleErr;
  return handleUpload(req, requestId, session!, learnerId);
}
