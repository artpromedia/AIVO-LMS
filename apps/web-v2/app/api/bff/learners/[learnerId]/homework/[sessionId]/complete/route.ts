import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole, requireLearnerScope } from "@/lib/bff/guards";
import { requireLearnerConsent } from "@/lib/bff/consent-guard";
import { audit } from "@/lib/bff/audit";
import { completeHomeworkSession, getHomeworkSession } from "@/lib/db/repos";
import { buildHomeworkInsight } from "@/lib/homework/tutor";

export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ learnerId: string; sessionId: string }>;
};

/** POST — close out a homework session and persist a parent-visible insight. */
export async function POST(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId, sessionId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["learner", "parent"], requestId);
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

    const existing = await getHomeworkSession(sessionId, session!.tenantId);
    if (!existing || existing.learnerId !== learnerId) {
      return fail({ ...ERRORS.NOT_FOUND, message: "Homework session not found." }, requestId);
    }
    if (existing.endedAt) {
      return ok({ session: existing }, requestId);
    }
    const insight = buildHomeworkInsight(existing.topic, existing.messages.length);
    const ended = await completeHomeworkSession(sessionId, session!.tenantId, insight);
    audit(session!, "homework.complete", requestId, {
      learnerId,
      metadata: { sessionId, messageCount: existing.messages.length },
    });
    return ok({ session: ended }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
