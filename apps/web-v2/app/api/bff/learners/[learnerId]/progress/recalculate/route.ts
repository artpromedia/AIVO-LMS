/**
 * Sprint 14: POST /api/bff/learners/:learnerId/progress/recalculate
 *
 * Mastery is already updated on every lesson_run.complete; this endpoint
 * exists as an explicit "refresh my view" action for the parent. It
 * regenerates the learning path from the current MasteryMap and returns the
 * freshened aggregate.
 */
import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole, requireLearnerScope } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import { getLearner, regenerateLearningPath } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ learnerId: string }> };

export async function POST(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["parent", "teacher"], requestId);
    if (roleErr) return roleErr;
    const scope = requireLearnerScope(session!, learnerId, requestId);
    if (scope) return scope;

    const learner = getLearner(learnerId, session!.tenantId);
    if (!learner)
      return fail({ ...ERRORS.NOT_FOUND, message: "Learner not found" }, requestId);

    const path = regenerateLearningPath(learnerId, session!.tenantId);
    audit(session!, "progress.recalculate", requestId, { learnerId });
    return ok({ learningPathId: path?.id ?? null }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
