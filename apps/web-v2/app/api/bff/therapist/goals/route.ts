/**
 * Sprint 9 — IEP goal CRUD for the therapist role.
 *
 *   GET   /api/bff/therapist/goals?learnerId=...
 *   POST  /api/bff/therapist/goals
 *   PATCH /api/bff/therapist/goals/{goalId}/progress   (handled in [goalId]/progress)
 */
import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { createIepGoal, listIepGoals } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["therapist", "teacher"], requestId);
    if (roleErr) return roleErr;
    const learnerId = new URL(req.url).searchParams.get("learnerId");
    if (!learnerId)
      return fail(
        {
          code: "validation_error",
          message: "learnerId is required",
          userMessage: "Pick a learner first.",
          status: 400,
        },
        requestId,
      );
    return ok({ goals: listIepGoals(learnerId, session!.tenantId) }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["therapist", "teacher"], requestId);
    if (roleErr) return roleErr;
    const body = (await req.json().catch(() => null)) as {
      learnerId?: string;
      domain?: string;
      goalText?: string;
      baseline?: string;
      targetCriteria?: string;
      measurableCriteria?: string;
    } | null;
    if (!body?.learnerId || !body.domain || !body.goalText) {
      return fail(
        {
          code: "validation_error",
          message: "learnerId, domain, goalText are required",
          userMessage: "Please complete the goal form before saving.",
          status: 400,
        },
        requestId,
      );
    }
    const goal = createIepGoal({
      tenantId: session!.tenantId,
      learnerId: body.learnerId,
      authoredByUserId: session!.userId,
      domain: body.domain,
      goalText: body.goalText,
      baseline: body.baseline,
      targetCriteria: body.targetCriteria,
      measurableCriteria: body.measurableCriteria,
    });
    return ok({ goal }, requestId, { status: 201 });
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
