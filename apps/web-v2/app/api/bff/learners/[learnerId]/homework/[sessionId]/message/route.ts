import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import {
  requireSession,
  requireRole,
  requireLearnerScope,
} from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import { checkRateLimit, RATE_LIMITS } from "@/lib/bff/rate-limit";
import { requireLearnerConsent } from "@/lib/bff/consent-guard";
import {
  appendHomeworkMessage,
  getHomeworkSession,
  SAFETY_BLOCKED_FALLBACK,
  SAFETY_CLASSIFY,
  SAFETY_SANITIZE,
  SAFETY_VALIDATE_TUTOR,
  getActiveSafetyPolicy,
  recordBlockedGeneration,
  recordHomeworkInputAudit,
  recordModerationEvent,
  recordTutorResponseAudit,
} from "@/lib/db/repos";
import { generateGuidedReply } from "@/lib/homework/tutor";

export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ learnerId: string; sessionId: string }>;
};

/**
 * POST — learner posts a message, tutor immediately responds (guided-only).
 * Only the learner role may post; parents/teachers can read history but not
 * speak in-session (avoids confusing the learner about who's helping).
 */
export async function POST(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId, sessionId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["learner"], requestId);
    if (roleErr) return roleErr;
    const scope = requireLearnerScope(session!, learnerId, requestId);
    if (scope) return scope;
    const limited = checkRateLimit(
      session!.userId,
      { routeKey: "homework.message", ...RATE_LIMITS.AI_GENERATION },
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

    const body = (await req.json().catch(() => ({}))) as { text?: unknown };
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text || text.length > 2000) {
      return fail(
        { ...ERRORS.VALIDATION_FAILED, message: "Message must be 1–2000 characters." },
        requestId,
      );
    }
    const existing = getHomeworkSession(sessionId, session!.tenantId);
    if (!existing || existing.learnerId !== learnerId) {
      return fail(
        { ...ERRORS.NOT_FOUND, message: "Homework session not found." },
        requestId,
      );
    }
    if (existing.endedAt) {
      return fail(
        {
          ...ERRORS.PRECONDITION_FAILED,
          message: "This homework session has already ended.",
        },
        requestId,
      );
    }

    // S27 safety pipeline — sanitize + classify learner input BEFORE the
    // tutor sees it. Prompt-injection scaffolding is stripped; PII is
    // redacted; injection-only inputs are blocked with a safe fallback.
    const policy = getActiveSafetyPolicy();
    const sanitized = SAFETY_SANITIZE(text);
    const inputCls = SAFETY_CLASSIFY(sanitized.cleaned, {
      subjectKind: "homework_input",
      policy,
    });
    recordHomeworkInputAudit({
      tenantId: session!.tenantId,
      learnerId,
      homeworkSessionId: sessionId,
      rawExcerpt: text,
      sanitizedExcerpt: sanitized.cleaned,
      classification: inputCls.classification,
      piiRedacted: sanitized.piiRedacted,
    });
    if (inputCls.classification.decision !== "allow" || sanitized.injectionStripped) {
      recordModerationEvent({
        tenantId: session!.tenantId,
        learnerId,
        subjectKind: "homework_input",
        subjectRefId: sessionId,
        excerpt: text,
        classification: inputCls.classification,
        injectionSignals: inputCls.injectionSignals,
        crisisSignals: inputCls.crisisSignals,
        createdByUserId: session!.userId,
      });
    }
    if (inputCls.classification.decision === "block") {
      const fallback = SAFETY_BLOCKED_FALLBACK("homework_input");
      recordBlockedGeneration({
        tenantId: session!.tenantId,
        learnerId,
        subjectKind: "homework_input",
        reason: `Blocked categories: ${inputCls.classification.categories.join(",")}`,
        fallbackResponse: fallback,
      });
      // Persist the original (raw) learner message so the audit trail is
      // complete, then a tutor turn carrying the safety fallback.
      appendHomeworkMessage(sessionId, session!.tenantId, {
        role: "learner",
        text,
        guidedOnly: false,
      });
      const blocked = appendHomeworkMessage(sessionId, session!.tenantId, {
        role: "tutor",
        text: fallback,
        guidedOnly: true,
      });
      audit(session!, "homework.message.blocked", requestId, {
        learnerId,
        metadata: { sessionId, reason: "input_safety_block" },
      });
      return ok({ session: blocked, blocked: true }, requestId);
    }

    appendHomeworkMessage(sessionId, session!.tenantId, {
      role: "learner",
      text,
      guidedOnly: false,
    });
    const priorTutorTurns = existing.messages.filter((m) => m.role === "tutor").length;
    const reply = generateGuidedReply({
      topic: existing.topic,
      subjectId: existing.subjectId,
      turn: priorTutorTurns,
      latestLearnerMessage: sanitized.cleaned,
    });

    // Post-classify tutor output. We always audit the tutor turn; if rule
    // violations are detected, replace the reply with a blocked fallback.
    const tutorRule = SAFETY_VALIDATE_TUTOR(reply.text);
    const tutorCls = SAFETY_CLASSIFY(reply.text, {
      subjectKind: "tutor_response",
      policy,
    });
    recordTutorResponseAudit({
      tenantId: session!.tenantId,
      learnerId,
      contextKind: "homework_session",
      contextRefId: sessionId,
      tutorPersona: "homework_tutor",
      excerpt: reply.text,
      classification: tutorCls.classification,
    });
    let finalText = reply.text;
    let blockedOutput = false;
    if (!tutorRule.ok || tutorCls.classification.decision === "block") {
      finalText = SAFETY_BLOCKED_FALLBACK("tutor_response");
      blockedOutput = true;
      recordBlockedGeneration({
        tenantId: session!.tenantId,
        learnerId,
        subjectKind: "tutor_response",
        reason: tutorRule.ok
          ? `Categories: ${tutorCls.classification.categories.join(",")}`
          : `Tutor rule: ${tutorRule.violations.map((v) => v.rule).join(",")}`,
        fallbackResponse: finalText,
      });
      recordModerationEvent({
        tenantId: session!.tenantId,
        learnerId,
        subjectKind: "tutor_response",
        subjectRefId: sessionId,
        excerpt: reply.text,
        classification: tutorCls.classification,
        injectionSignals: tutorCls.injectionSignals,
        crisisSignals: tutorCls.crisisSignals,
        createdByUserId: null,
      });
    }

    const after = appendHomeworkMessage(sessionId, session!.tenantId, {
      role: "tutor",
      text: finalText,
      guidedOnly: reply.guidedOnly,
    });
    audit(session!, "homework.message", requestId, {
      learnerId,
      metadata: {
        sessionId,
        turn: priorTutorTurns + 1,
        inputDecision: inputCls.classification.decision,
        tutorBlocked: blockedOutput ? "1" : "0",
      },
    });
    return ok({ session: after }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
