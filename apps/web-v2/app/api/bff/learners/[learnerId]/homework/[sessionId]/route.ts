import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole, requireLearnerScope } from "@/lib/bff/guards";
import { requireLearnerConsent } from "@/lib/bff/consent-guard";
import { getHomeworkSession } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ learnerId: string; sessionId: string }> };

/** GET — fetch a single homework session (learner: full; parent/teacher: redacted). */
export async function GET(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId, sessionId } = await params;
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

    const hw = getHomeworkSession(sessionId, session!.tenantId);
    if (!hw || hw.learnerId !== learnerId) {
      return fail({ ...ERRORS.NOT_FOUND, message: "Homework session not found." }, requestId);
    }
    const isLearner = session!.role === "learner";
    return ok(
      {
        session: {
          id: hw.id,
          learnerId: hw.learnerId,
          topic: hw.topic,
          subjectId: hw.subjectId,
          startedAt: hw.startedAt,
          endedAt: hw.endedAt,
          insight: hw.insight,
          followUpRunId: hw.followUpRunId,
          messageCount: hw.messages.length,
          messages: isLearner ? hw.messages : undefined,
        },
      },
      requestId,
    );
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
