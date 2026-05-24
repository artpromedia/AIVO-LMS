import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole, requireLearnerScope } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import { checkRateLimit, RATE_LIMITS } from "@/lib/bff/rate-limit";
import { requireLearnerConsent } from "@/lib/bff/consent-guard";
import {
  createHomeworkSession,
  listHomeworkSessionsForLearner,
  appendHomeworkMessage,
} from "@/lib/db/repos";
import { classifySubject, generateGuidedReply } from "@/lib/homework/tutor";
import { parseHomeworkAttachment } from "@/lib/homework/attachments";
import type { HomeworkAttachment } from "@/lib/db/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ learnerId: string }> };

/** GET — list homework sessions for the learner (most recent first). */
export async function GET(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["parent", "learner", "teacher"], requestId);
    if (roleErr) return roleErr;
    const scope = requireLearnerScope(session!, learnerId, requestId);
    if (scope) return scope;
    const sessions = listHomeworkSessionsForLearner(learnerId, session!.tenantId, {
      limit: 50,
    });
    // Parents/teachers only see topic + insight + timestamps, not raw messages.
    const isLearner = session!.role === "learner";
    const safe = sessions.map((s) => ({
      id: s.id,
      topic: s.topic,
      subjectId: s.subjectId,
      insight: s.insight,
      followUpRunId: s.followUpRunId,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      messageCount: s.messages.length,
      messages: isLearner ? s.messages : undefined,
    }));
    return ok({ sessions: safe }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

/** POST — start a new homework session and generate the opening tutor reply. */
export async function POST(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["learner", "parent"], requestId);
    if (roleErr) return roleErr;
    const scope = requireLearnerScope(session!, learnerId, requestId);
    if (scope) return scope;
    const limited = checkRateLimit(
      session!.userId,
      { routeKey: "homework.create", ...RATE_LIMITS.AI_GENERATION },
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

    const body = (await req.json().catch(() => ({}))) as {
      topic?: unknown;
      attachment?: unknown;
    };
    const topic = typeof body.topic === "string" ? body.topic.trim() : "";
    if (!topic || topic.length > 500) {
      return fail(
        { ...ERRORS.VALIDATION_FAILED, message: "Topic is required (1–500 chars)." },
        requestId,
      );
    }
    let attachment: HomeworkAttachment | null = null;
    if (body.attachment !== undefined && body.attachment !== null) {
      const parsed = parseHomeworkAttachment(body.attachment);
      if (!parsed.ok) {
        const messageByReason: Record<typeof parsed.reason, string> = {
          invalid_shape: "Attachment is malformed.",
          invalid_mime: "Only PNG, JPEG, WEBP, or PDF attachments are allowed.",
          invalid_base64: "Attachment data is not valid base64.",
          too_large: "Attachment is larger than the 10 MB limit.",
        };
        return fail(
          { ...ERRORS.VALIDATION_FAILED, message: messageByReason[parsed.reason] },
          requestId,
        );
      }
      attachment = parsed.attachment;
    }
    const subjectId = classifySubject(topic);
    const created = createHomeworkSession({
      learnerId,
      tenantId: session!.tenantId,
      topic,
      subjectId,
      attachment,
    });
    // Seed turn-0 tutor reply so the learner sees something to react to.
    const opener = generateGuidedReply({ topic, subjectId, turn: 0 });
    const withOpener = appendHomeworkMessage(created.id, session!.tenantId, {
      role: "tutor",
      text: opener.text,
      guidedOnly: opener.guidedOnly,
    });
    audit(session!, "homework.start", requestId, {
      learnerId,
      metadata: {
        sessionId: created.id,
        subjectId,
        attachment: attachment
          ? { mimeType: attachment.mimeType, sizeBytes: attachment.sizeBytes }
          : null,
      },
    });
    return ok({ session: withOpener ?? created }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
