import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole, requireLearnerScope } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import { checkRateLimit, RATE_LIMITS } from "@/lib/bff/rate-limit";
import { requireLearnerConsent } from "@/lib/bff/consent-guard";
import { getLessonRun, retryLessonRun } from "@/lib/db/repos";

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
    const limited = checkRateLimit(
      session!.userId,
      { routeKey: "lesson-run.retry", ...RATE_LIMITS.AI_GENERATION },
      requestId,
    );
    if (limited) return limited;
    const consentErr = requireLearnerConsent(
      session!,
      learnerId,
      ["child_data_collection", "ai_personalization"],
      requestId,
    );
    if (consentErr) return consentErr;
    const found = getLessonRun(lessonRunId, session!.tenantId);
    if (!found || found.lessonRun.learnerId !== learnerId) {
      return fail({ ...ERRORS.NOT_FOUND, message: "Lesson run not found" }, requestId);
    }
    const result = await retryLessonRun(lessonRunId, session!.tenantId);
    audit(session!, result.ok ? "lesson_run.retry" : "lesson_run.retry.failed", requestId, {
      learnerId,
      metadata: {
        lessonRunId,
        retryCount: result.lessonRun.retryCount,
        status: result.lessonRun.status,
      },
    });
    if (!result.ok) {
      const errKey =
        result.code === "not_retryable" ? ERRORS.PRECONDITION_FAILED : ERRORS.UPSTREAM_UNAVAILABLE;
      return fail(
        {
          ...errKey,
          message:
            result.code === "not_retryable"
              ? `Cannot retry a ${result.lessonRun.status} run`
              : (result.lessonRun.failureReason ?? "Retry failed"),
        },
        requestId,
      );
    }
    return ok({ lessonRun: result.lessonRun, plan: result.plan }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
