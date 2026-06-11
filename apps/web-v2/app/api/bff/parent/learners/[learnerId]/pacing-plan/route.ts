/**
 * Wave B — parent pacing-plan surface.
 * GET  /api/bff/parent/learners/:learnerId/pacing-plan?subject=…
 * POST /api/bff/parent/learners/:learnerId/pacing-plan
 *      { subject, planStart } — generates from the SAVED term syllabus.
 */
import { NextResponse } from "next/server";
import { getRequestId } from "@/lib/bff/response";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { handleGeneratePacingPlan, handleGetPacingPlan } from "@/lib/bff/school-calendar";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ learnerId: string }> };

export async function GET(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId } = await params;
  const { session, response } = await requireSession(req, requestId);
  if (response) return response;
  const roleErr = requireRole(session!, ["parent", "caregiver"], requestId);
  if (roleErr) return roleErr;
  return handleGetPacingPlan(req, requestId, session!, learnerId);
}

export async function POST(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId } = await params;
  const { session, response } = await requireSession(req, requestId);
  if (response) return response;
  const roleErr = requireRole(session!, ["parent", "caregiver"], requestId);
  if (roleErr) return roleErr;
  return handleGeneratePacingPlan(req, requestId, session!, learnerId);
}
