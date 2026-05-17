import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole, requireLearnerScope } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import { LessonStepInput } from "@/lib/validators/lesson";
import { getLessonRun, recordLessonStep } from "@/lib/db/repos";

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
    const body = await req.json().catch(() => null);
    const parsed = LessonStepInput.safeParse(body);
    if (!parsed.success) {
      return fail(
        { ...ERRORS.VALIDATION_FAILED, message: parsed.error.issues[0]?.message ?? "Invalid step" },
        requestId,
      );
    }
    const found = getLessonRun(lessonRunId, session!.tenantId);
    if (!found || found.lessonRun.learnerId !== learnerId) {
      return fail({ ...ERRORS.NOT_FOUND, message: "Lesson run not found" }, requestId);
    }
    if (
      found.lessonRun.status !== "ready" &&
      found.lessonRun.status !== "in_progress"
    ) {
      return fail(
        {
          ...ERRORS.PRECONDITION_FAILED,
          message: `Cannot record step on a ${found.lessonRun.status} run`,
        },
        requestId,
      );
    }
    const interaction = recordLessonStep({
      lessonRunId,
      tenantId: session!.tenantId,
      learnerId,
      stepKind: parsed.data.stepKind,
      stepRefId: parsed.data.stepRefId ?? null,
      response: parsed.data.response ?? null,
      isCorrect: parsed.data.isCorrect ?? null,
      skipped: parsed.data.skipped ?? false,
    });
    if (!interaction)
      return fail({ ...ERRORS.NOT_FOUND, message: "Lesson run not found" }, requestId);
    audit(session!, "lesson_run.step", requestId, {
      learnerId,
      metadata: {
        lessonRunId,
        stepKind: parsed.data.stepKind,
        isCorrect: parsed.data.isCorrect ?? null,
        skipped: parsed.data.skipped ?? false,
      },
    });
    return ok({ interaction }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
