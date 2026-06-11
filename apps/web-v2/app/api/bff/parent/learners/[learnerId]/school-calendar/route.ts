/**
 * Wave B — parent school-calendar surface.
 * GET/PUT /api/bff/parent/learners/:learnerId/school-calendar
 */
import { NextResponse } from "next/server";
import { getRequestId } from "@/lib/bff/response";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { handleGetSchoolCalendar, handlePutSchoolCalendar } from "@/lib/bff/school-calendar";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ learnerId: string }> };

export async function GET(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId } = await params;
  const { session, response } = await requireSession(req, requestId);
  if (response) return response;
  const roleErr = requireRole(session!, ["parent", "caregiver"], requestId);
  if (roleErr) return roleErr;
  return handleGetSchoolCalendar(req, requestId, session!, learnerId);
}

export async function PUT(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId } = await params;
  const { session, response } = await requireSession(req, requestId);
  if (response) return response;
  const roleErr = requireRole(session!, ["parent", "caregiver"], requestId);
  if (roleErr) return roleErr;
  return handlePutSchoolCalendar(req, requestId, session!, learnerId);
}
