import { NextResponse } from "next/server";
import { getRequestId } from "@/lib/bff/response";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { handleParsePreview } from "@/lib/bff/curriculum";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ learnerId: string }> };

/** POST /api/bff/teacher/learners/:learnerId/curriculum/parse-preview */
export async function POST(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId } = await params;
  const { session, response } = await requireSession(req, requestId);
  if (response) return response;
  const roleErr = requireRole(session!, ["teacher", "school_admin", "district_admin"], requestId);
  if (roleErr) return roleErr;
  return handleParsePreview(req, requestId, session!, learnerId);
}
