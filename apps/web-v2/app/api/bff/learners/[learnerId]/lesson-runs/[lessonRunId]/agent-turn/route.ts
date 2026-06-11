/**
 * Wave E (S9) — one tutor-agent turn for a lesson run (Nova pilot).
 *
 * POST { sessionId, observation } →
 *   { enabled: true, decision, directive } | { enabled: false }
 *
 * The decision is tutor-svc's validated TurnDecision; the directive is the
 * pure client-side translation (lib/learner/agent-directives.ts) computed
 * here too so the player can apply it without re-deriving. Every failure
 * mode — flag off, bad body, tutor-svc error, timeout — returns a
 * deterministic shape; this route never breaks the lesson.
 */
import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole, requireLearnerScope } from "@/lib/bff/guards";
import { requireLearnerConsent } from "@/lib/bff/consent-guard";
import { getLessonRun } from "@/lib/db/repos";
import { tutorAgenticModeEnabled } from "@/lib/feature-flags";
import { isLiveTutorAgent, tutorAgentTurn } from "@/lib/bff/tutor-agent";
import { directiveFromDecision } from "@/lib/learner/agent-directives";
import { logger } from "@/lib/observability/logger";

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
    const scope = await requireLearnerScope(session!, learnerId, requestId);
    if (scope) return scope;
    const consentErr = await requireLearnerConsent(
      session!,
      learnerId,
      ["child_data_collection", "ai_personalization"],
      requestId,
    );
    if (consentErr) return consentErr;

    if (!(await tutorAgenticModeEnabled()) || !isLiveTutorAgent()) {
      return ok({ enabled: false }, requestId);
    }

    const body = (await req.json().catch(() => null)) as {
      sessionId?: unknown;
      observation?: unknown;
    } | null;
    const sessionId = typeof body?.sessionId === "string" ? body.sessionId : "";
    const observation =
      body?.observation && typeof body.observation === "object"
        ? (body.observation as Record<string, unknown>)
        : null;
    if (!sessionId || !observation) {
      return fail(
        { ...ERRORS.VALIDATION_FAILED, message: "sessionId and observation are required" },
        requestId,
      );
    }

    const found = await getLessonRun(lessonRunId, session!.tenantId);
    if (!found || found.lessonRun.learnerId !== learnerId) {
      return fail({ ...ERRORS.NOT_FOUND, message: "Lesson run not found" }, requestId);
    }

    try {
      const decision = await tutorAgentTurn({ sessionId, learnerId, observation });
      return ok(
        { enabled: true, decision, directive: directiveFromDecision(decision) },
        requestId,
      );
    } catch (err) {
      logger.warn(
        {
          feature: "tutor-agent",
          learnerId,
          lessonRunId,
          err: err instanceof Error ? err.message : String(err),
        },
        "[tutor-agent] turn failed — deterministic fallback",
      );
      return ok({ enabled: false }, requestId);
    }
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
