/**
 * Wave E (S9) — open a tutor-agent session for a lesson run (Nova pilot).
 *
 * POST → { enabled: boolean, session?: { sessionId, tutorKey, tutorName } }
 *
 * `enabled: false` is a NORMAL response, not an error: flag off, subject
 * not piloted, agent service not configured, or open failure all degrade
 * to the deterministic lesson player. The client treats anything except
 * `enabled: true` as "play today's lesson exactly as before".
 */
import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole, requireLearnerScope } from "@/lib/bff/guards";
import { requireLearnerConsent } from "@/lib/bff/consent-guard";
import { audit } from "@/lib/bff/audit";
import { getLearner, getLessonRun, getSubjectById } from "@/lib/db/repos";
import { tutorAgenticModeEnabled } from "@/lib/feature-flags";
import { isLiveTutorAgent, tutorAgentOpen } from "@/lib/bff/tutor-agent";
import { logger } from "@/lib/observability/logger";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ learnerId: string; lessonRunId: string }> };

/** Pilot scope: subject slug → tutor key. Nova (math) first; widening this
 *  map is the S13 onboarding lever, not a code change per tutor. */
const PILOT_SUBJECT_TUTORS: Record<string, string> = {
  math: "nova",
};

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
      return ok({ enabled: false, reason: "flag_off" }, requestId);
    }

    const found = await getLessonRun(lessonRunId, session!.tenantId);
    if (!found || found.lessonRun.learnerId !== learnerId) {
      return fail({ ...ERRORS.NOT_FOUND, message: "Lesson run not found" }, requestId);
    }
    const subject = await getSubjectById(found.lessonRun.subjectId);
    const tutorKey = subject ? PILOT_SUBJECT_TUTORS[subject.slug] : undefined;
    if (!tutorKey) {
      return ok({ enabled: false, reason: "subject_not_piloted" }, requestId);
    }

    const learner = await getLearner(learnerId, session!.tenantId);
    try {
      const opened = await tutorAgentOpen({
        learnerId,
        tutorKey,
        lessonRunId,
        gradeBand: learner?.gradeBand ?? null,
        functioningLevel: learner?.functioningLevel ?? null,
      });
      audit(session!, "tutor_agent.session_opened", requestId, {
        learnerId,
        metadata: { lessonRunId, tutorKey, sessionId: opened.sessionId },
      });
      return ok(
        {
          enabled: true,
          session: {
            sessionId: opened.sessionId,
            tutorKey: opened.tutorKey,
            tutorName: opened.tutorName,
          },
        },
        requestId,
      );
    } catch (err) {
      // The agent is an enrichment — an open failure must never block the
      // lesson. Report disabled and let the player run deterministically.
      logger.warn(
        {
          feature: "tutor-agent",
          learnerId,
          lessonRunId,
          err: err instanceof Error ? err.message : String(err),
        },
        "[tutor-agent] open failed — falling back to deterministic player",
      );
      return ok({ enabled: false, reason: "open_failed" }, requestId);
    }
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
