import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole, requireLearnerScope } from "@/lib/bff/guards";
import { requireLearnerConsent } from "@/lib/bff/consent-guard";
import { audit } from "@/lib/bff/audit";
import { LessonStepInput } from "@/lib/validators/lesson";
import { getLessonRun, recordLessonStep } from "@/lib/db/repos";
import {
  readIdempotencyCache,
  readIdempotencyKey,
  writeIdempotencyCache,
} from "@/lib/offline/idempotency";

const IDEMPOTENCY_ROUTE = "POST /api/bff/learners/:learnerId/lesson-runs/:lessonRunId/step";

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
    const consentErr = requireLearnerConsent(
      session!,
      learnerId,
      ["child_data_collection", "ai_personalization"],
      requestId,
    );
    if (consentErr) return consentErr;
    // Sprint 9 — idempotency-key short-circuit. The offline outbox
    // replays mutating calls after the network recovers; if the
    // original request already hit the server, return the cached
    // response instead of re-recording the step.
    const idemKey = readIdempotencyKey(req);
    if (idemKey) {
      const cached = readIdempotencyCache(session!.tenantId, IDEMPOTENCY_ROUTE, idemKey);
      if (cached) {
        return NextResponse.json(cached.body, {
          status: cached.status,
          headers: { "Idempotency-Replay": "true" },
        });
      }
    }
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
    if (found.lessonRun.status !== "ready" && found.lessonRun.status !== "in_progress") {
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
    const okResponse = ok({ interaction }, requestId);
    // Cache the response body+status for replay-safe idempotency.
    if (idemKey) {
      writeIdempotencyCache(
        session!.tenantId,
        IDEMPOTENCY_ROUTE,
        idemKey,
        { interaction },
        200,
      );
    }
    return okResponse;
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
