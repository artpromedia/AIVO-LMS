import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole, requireLearnerScope } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import { checkRateLimit, RATE_LIMITS } from "@/lib/bff/rate-limit";
import { requireLearnerConsent } from "@/lib/bff/consent-guard";
import { LessonRunCreateInput } from "@/lib/validators/lesson";
import { createLessonRun, listLessonRunsForLearner } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ learnerId: string }> };

/** GET — list recent LessonRuns for a learner (parent/learner/staff). */
export async function GET(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(
      session!,
      ["parent", "learner", "teacher", "school_admin"],
      requestId,
    );
    if (roleErr) return roleErr;
    const scope = requireLearnerScope(session!, learnerId, requestId);
    if (scope) return scope;
    const limitParam = new URL(req.url).searchParams.get("limit");
    const limit = limitParam
      ? Math.min(100, Math.max(1, Number.parseInt(limitParam, 10) || 25))
      : 25;
    const runs = listLessonRunsForLearner(learnerId, session!.tenantId, { limit });
    return ok({ lessonRuns: runs }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

/** POST — create a LessonRun and synchronously generate its plan. */
export async function POST(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["parent", "learner", "teacher"], requestId);
    if (roleErr) return roleErr;
    const scope = requireLearnerScope(session!, learnerId, requestId);
    if (scope) return scope;
    const limited = checkRateLimit(
      session!.userId,
      { routeKey: "lesson-run.create", ...RATE_LIMITS.AI_GENERATION },
      requestId,
    );
    if (limited) return limited;
    const consentErr = await requireLearnerConsent(
      session!,
      learnerId,
      ["child_data_collection", "ai_personalization"],
      requestId,
    );
    if (consentErr) return consentErr;
    const body = await req.json().catch(() => null);
    const parsed = LessonRunCreateInput.safeParse(body);
    if (!parsed.success) {
      return fail(
        {
          ...ERRORS.VALIDATION_FAILED,
          message: parsed.error.issues[0]?.message ?? "Invalid input",
        },
        requestId,
      );
    }
    const result = await createLessonRun({
      learnerId,
      tenantId: session!.tenantId,
      subjectId: parsed.data.subjectId,
      skillId: parsed.data.skillId,
      source: parsed.data.source,
      sourceRefId: parsed.data.sourceRefId ?? null,
    });
    if (!result.ok) {
      const errMap = {
        learner_not_found: ERRORS.NOT_FOUND,
        subject_not_found: ERRORS.NOT_FOUND,
        skill_not_found: ERRORS.NOT_FOUND,
        brain_profile_missing: ERRORS.PRECONDITION_FAILED,
        generation_failed: ERRORS.UPSTREAM_UNAVAILABLE,
      } as const;
      audit(session!, "lesson_run.create.failed", requestId, {
        learnerId,
        metadata: { code: result.code, source: parsed.data.source },
      });
      return fail({ ...errMap[result.code], message: result.message }, requestId);
    }
    audit(session!, "lesson_run.create", requestId, {
      learnerId,
      metadata: {
        lessonRunId: result.lessonRun.id,
        source: result.lessonRun.source,
        subjectId: result.lessonRun.subjectId,
        skillId: result.lessonRun.skillId,
        provider: result.plan.generation.provider,
        attempts: result.plan.generation.attempts,
      },
    });
    return ok({ lessonRun: result.lessonRun, plan: result.plan }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
