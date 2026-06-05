import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole, requireLearnerScope } from "@/lib/bff/guards";
import { getServerLearningClient } from "@/lib/bff/learning-svc";
import { LearningClientError } from "@aivo/api-client/learning";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ learnerId: string; subject: string }> };

export async function POST(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId, subject } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["parent", "learner", "teacher"], requestId);
    if (roleErr) return roleErr;
    const scope = await requireLearnerScope(session!, learnerId, requestId);
    if (scope) return scope;

    const client = getServerLearningClient(req.headers.get("authorization"));
    const out = await client.initLearningPath(learnerId, subject);
    return ok(out, requestId);
  } catch (e) {
    if (e instanceof LearningClientError) {
      return fail({ ...ERRORS.UPSTREAM_UNAVAILABLE, message: e.message }, requestId);
    }
    return failFromUnknown(e, requestId);
  }
}
