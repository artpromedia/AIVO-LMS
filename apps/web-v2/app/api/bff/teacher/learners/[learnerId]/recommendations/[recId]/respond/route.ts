/**
 * Wave C (G5) — teacher decision on a profile recommendation.
 * POST /api/bff/teacher/learners/:learnerId/recommendations/:recId/respond
 *
 * recommendation-svc enforces the delegation policy: a teacher decision
 * lands only for instructional types in tenants whose district enabled
 * teacherApproval; everything else 403s (surfaced as FORBIDDEN_ROLE).
 */
import { NextResponse } from "next/server";
import { getRequestId } from "@/lib/bff/response";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { handleRespondToRecommendation } from "@/lib/bff/recommendation-approvals";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ learnerId: string; recId: string }> };

export async function POST(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId, recId } = await params;
  const { session, response } = await requireSession(req, requestId);
  if (response) return response;
  const roleErr = requireRole(session!, ["teacher"], requestId);
  if (roleErr) return roleErr;
  return handleRespondToRecommendation(req, requestId, session!, learnerId, recId, "teacher");
}
