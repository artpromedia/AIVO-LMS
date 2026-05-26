/**
 * Sprint 11 — teacher gradebook detail.
 *
 *   GET /api/bff/teacher/gradebook?learnerId=...
 *
 * Per-skill mastery breakdown so the teacher dashboard can show
 * exactly where a learner is and where they're stuck.
 */
import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { requireSession, requireRole } from "@/lib/bff/guards";
import { getGradebookDetail, teacherCanAccessLearner } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(
      session!,
      ["teacher", "school_admin", "district_admin"],
      requestId,
    );
    if (roleErr) return roleErr;
    const learnerId = new URL(req.url).searchParams.get("learnerId");
    if (!learnerId) {
      return fail(
        { code: "validation_error", message: "learnerId is required", userMessage: "Pick a learner first.", status: 400 },
        requestId,
      );
    }
    // Teachers may only view learners on their roster.
    if (
      session!.role === "teacher" &&
      !teacherCanAccessLearner(session!.userId, learnerId, session!.tenantId)
    ) {
      return fail(
        { code: "forbidden", message: "Learner not on teacher roster", userMessage: "That learner is not on your roster.", status: 403 },
        requestId,
      );
    }
    const detail = getGradebookDetail(learnerId, session!.tenantId);
    return ok({ detail }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
