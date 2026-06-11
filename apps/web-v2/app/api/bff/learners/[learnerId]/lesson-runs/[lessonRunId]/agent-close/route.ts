/**
 * Wave E (S9) — close a tutor-agent session when the lesson ends.
 *
 * POST { sessionId, reason? } → { closed: boolean }
 *
 * Best-effort by design: the lesson "complete" flow must never wait on or
 * fail because of agent-session bookkeeping.
 */
import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole, requireLearnerScope } from "@/lib/bff/guards";
import { requireLearnerConsent } from "@/lib/bff/consent-guard";
import { tutorAgenticModeEnabled } from "@/lib/feature-flags";
import { isLiveTutorAgent, tutorAgentCloseSafe } from "@/lib/bff/tutor-agent";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ learnerId: string; lessonRunId: string }> };

export async function POST(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId } = await params;
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
      return ok({ closed: false }, requestId);
    }
    const body = (await req.json().catch(() => null)) as {
      sessionId?: unknown;
      reason?: unknown;
    } | null;
    const sessionId = typeof body?.sessionId === "string" ? body.sessionId : "";
    if (!sessionId) {
      return fail({ ...ERRORS.VALIDATION_FAILED, message: "sessionId is required" }, requestId);
    }
    await tutorAgentCloseSafe({
      sessionId,
      reason: typeof body?.reason === "string" ? body.reason : "player_done",
    });
    return ok({ closed: true }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
