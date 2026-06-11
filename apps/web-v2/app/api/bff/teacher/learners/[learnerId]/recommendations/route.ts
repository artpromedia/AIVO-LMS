/**
 * Wave C (G5) — teacher recommendation list.
 * GET /api/bff/teacher/learners/:learnerId/recommendations
 */
import { NextResponse } from "next/server";
import { getRequestId } from "@/lib/bff/response";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { handleListRecommendations } from "@/lib/bff/recommendation-approvals";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ learnerId: string }> };

export async function GET(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId } = await params;
  const { session, response } = await requireSession(req, requestId);
  if (response) return response;
  const roleErr = requireRole(session!, ["teacher"], requestId);
  if (roleErr) return roleErr;
  return handleListRecommendations(req, requestId, session!, learnerId);
}
