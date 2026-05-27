import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole, requireLearnerScope } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import { checkRateLimit, RATE_LIMITS } from "@/lib/bff/rate-limit";
import { requireLearnerConsent } from "@/lib/bff/consent-guard";
import { pickTodaysMission } from "@/lib/learner/today";
import { createLessonRun, getLessonRun } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ learnerId: string }> };

/**
 * POST /api/bff/learners/:learnerId/today/start
 *
 * Idempotent: if today's mission is a resume of an in-progress run, returns
 * that run rather than creating a new one. Otherwise creates the LessonRun
 * for the picked mission (and generates the plan) and returns it.
 */
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
      { routeKey: "today.start", ...RATE_LIMITS.AI_GENERATION },
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
    const picked = pickTodaysMission(learnerId, session!.tenantId);
    if (!picked.ready) {
      return fail(
        {
          ...ERRORS.PRECONDITION_FAILED,
          message:
            picked.blocker === "no_baseline"
              ? "Finish baseline before starting a lesson"
              : picked.blocker === "no_path"
                ? "Learning path missing — regenerate brain profile"
                : "Learner not found",
        },
        requestId,
      );
    }
    // Resume case → return existing run + plan.
    if (picked.mission.existingRunId) {
      const existing = getLessonRun(picked.mission.existingRunId, session!.tenantId);
      if (!existing) {
        return fail({ ...ERRORS.NOT_FOUND, message: "Run vanished" }, requestId);
      }
      audit(session!, "today.resume", requestId, {
        learnerId,
        metadata: { lessonRunId: existing.lessonRun.id },
      });
      return ok(
        {
          lessonRun: existing.lessonRun,
          plan: existing.plan,
          resumed: true,
          mission: picked.mission,
        },
        requestId,
      );
    }
    const result = await createLessonRun({
      learnerId,
      tenantId: session!.tenantId,
      subjectId: picked.mission.subjectId,
      skillId: picked.mission.skillId,
      source: picked.mission.source,
      sourceRefId: picked.mission.sourceRefId,
    });
    if (!result.ok) {
      const errMap = {
        learner_not_found: ERRORS.NOT_FOUND,
        subject_not_found: ERRORS.NOT_FOUND,
        skill_not_found: ERRORS.NOT_FOUND,
        brain_profile_missing: ERRORS.PRECONDITION_FAILED,
        generation_failed: ERRORS.UPSTREAM_UNAVAILABLE,
      } as const;
      return fail({ ...errMap[result.code], message: result.message }, requestId);
    }
    audit(session!, "today.start", requestId, {
      learnerId,
      metadata: {
        lessonRunId: result.lessonRun.id,
        missionKind: picked.mission.kind,
        source: picked.mission.source,
        subjectId: picked.mission.subjectId,
        skillId: picked.mission.skillId,
      },
    });
    return ok(
      { lessonRun: result.lessonRun, plan: result.plan, resumed: false, mission: picked.mission },
      requestId,
    );
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
