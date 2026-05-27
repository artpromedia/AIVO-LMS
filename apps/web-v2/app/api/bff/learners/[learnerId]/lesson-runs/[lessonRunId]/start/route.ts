import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole, requireLearnerScope } from "@/lib/bff/guards";
import { requireLearnerConsent } from "@/lib/bff/consent-guard";
import { audit } from "@/lib/bff/audit";
import { getLessonRun, startLessonRun } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ learnerId: string; lessonRunId: string }> };

export async function POST(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId, lessonRunId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["parent", "learner", "teacher"], requestId);
    if (roleErr) return roleErr;
    const scope = requireLearnerScope(session!, learnerId, requestId);
    if (scope) return scope;
    const consentErr = await requireLearnerConsent(
      session!,
      learnerId,
      ["child_data_collection", "ai_personalization"],
      requestId,
    );
    if (consentErr) return consentErr;
    const existing = await getLessonRun(lessonRunId, session!.tenantId);
    if (!existing || existing.lessonRun.learnerId !== learnerId) {
      return fail({ ...ERRORS.NOT_FOUND, message: "Lesson run not found" }, requestId);
    }
    if (existing.lessonRun.status === "failed" || existing.lessonRun.status === "generating") {
      return fail(
        {
          ...ERRORS.PRECONDITION_FAILED,
          message: `Cannot start a ${existing.lessonRun.status} lesson run`,
        },
        requestId,
      );
    }
    const updated = await startLessonRun(lessonRunId, session!.tenantId);
    if (!updated) return fail({ ...ERRORS.NOT_FOUND, message: "Lesson run not found" }, requestId);
    audit(session!, "lesson_run.start", requestId, {
      learnerId,
      metadata: { lessonRunId: updated.id, status: updated.status },
    });
    return ok({ lessonRun: updated }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
