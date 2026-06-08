import { NextResponse } from "next/server";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireRole, requireLearnerScope } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import { checkRateLimit, RATE_LIMITS } from "@/lib/bff/rate-limit";
import { requireLearnerConsent } from "@/lib/bff/consent-guard";
import {
  SAFETY_BLOCKED_FALLBACK,
  SAFETY_CLASSIFY,
  SAFETY_SANITIZE,
  SAFETY_VALIDATE_TUTOR,
  getActiveSafetyPolicy,
  recordBlockedGeneration,
  recordModerationEvent,
  recordTutorResponseAudit,
} from "@/lib/db/repos";
import { generateGuidedReply } from "@/lib/homework/tutor";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ learnerId: string }> };

type Turn = { role: "learner" | "tutor"; text: string };

/**
 * Sprint 4 (learner roadmap): stateless Socratic tutor reply.
 *
 * Takes the learner's most recent message plus a short history hint
 * (used only to vary the prompt — nothing is persisted server-side) and
 * returns a single guided tutor turn. Reuses the same safety + audit
 * pipeline as the homework helper so every tutor turn is classified and
 * blocked-when-unsafe just like persistent homework sessions.
 *
 * The chat history lives on the client; this route is intentionally
 * stateless so the same endpoint can power a transient "ask anything"
 * surface without spawning empty homework sessions.
 */
export async function POST(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const roleErr = requireRole(session!, ["learner"], requestId);
    if (roleErr) return roleErr;
    const scope = await requireLearnerScope(session!, learnerId, requestId);
    if (scope) return scope;
    const limited = checkRateLimit(
      session!.userId,
      { routeKey: "tutor.reply", ...RATE_LIMITS.AI_GENERATION },
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

    const body = (await req.json().catch(() => ({}))) as {
      text?: unknown;
      priorTurnCount?: unknown;
      topic?: unknown;
    };
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text || text.length > 2000) {
      return fail(
        { ...ERRORS.VALIDATION_FAILED, message: "Message must be 1–2000 characters." },
        requestId,
      );
    }
    // priorTurnCount lets us vary the Socratic prompt without keeping
    // state. Clamp it so a hostile client cannot push the tutor into an
    // unexpected branch of `generateGuidedReply`.
    const rawTurn =
      typeof body.priorTurnCount === "number" && Number.isFinite(body.priorTurnCount)
        ? Math.floor(body.priorTurnCount)
        : 0;
    const priorTurnCount = Math.max(0, Math.min(rawTurn, 99));
    const topic =
      typeof body.topic === "string" && body.topic.trim().length > 0
        ? body.topic.trim().slice(0, 200)
        : text.slice(0, 200);

    // Safety pipeline — classify the learner input first, exactly as the
    // homework session route does. We DO NOT persist message audits here
    // (stateless route), but moderation + blocked-generation events are
    // still recorded so the safety dashboard sees the activity.
    const policy = await getActiveSafetyPolicy();
    const sanitized = SAFETY_SANITIZE(text);
    const inputCls = SAFETY_CLASSIFY(sanitized.cleaned, {
      subjectKind: "homework_input",
      policy,
    });
    if (inputCls.classification.decision !== "allow" || sanitized.injectionStripped) {
      await recordModerationEvent({
        tenantId: session!.tenantId,
        learnerId,
        subjectKind: "homework_input",
        subjectRefId: null,
        excerpt: text,
        classification: inputCls.classification,
        injectionSignals: inputCls.injectionSignals,
        crisisSignals: inputCls.crisisSignals,
        createdByUserId: session!.userId,
      });
    }
    if (inputCls.classification.decision === "block") {
      const fallback = SAFETY_BLOCKED_FALLBACK("homework_input");
      await recordBlockedGeneration({
        tenantId: session!.tenantId,
        learnerId,
        subjectKind: "homework_input",
        reason: `Blocked categories: ${inputCls.classification.categories.join(",")}`,
        fallbackResponse: fallback,
      });
      audit(session!, "tutor.reply.blocked", requestId, {
        learnerId,
        metadata: { reason: "input_safety_block" },
      });
      return ok({ reply: { role: "tutor", text: fallback }, blocked: true }, requestId);
    }

    const reply = await generateGuidedReply({
      topic,
      subjectId: null,
      turn: priorTurnCount,
      latestLearnerMessage: sanitized.cleaned,
      learnerId,
      tenantId: session!.tenantId,
    });

    // Post-classify the tutor output and substitute a safe fallback when
    // either the validator or the classifier flags it.
    const tutorRule = SAFETY_VALIDATE_TUTOR(reply.text);
    const tutorCls = SAFETY_CLASSIFY(reply.text, {
      subjectKind: "tutor_response",
      policy,
    });
    await recordTutorResponseAudit({
      tenantId: session!.tenantId,
      learnerId,
      contextKind: "homework_session",
      contextRefId: `tutor-reply:${requestId}`,
      tutorPersona: "homework_tutor",
      excerpt: reply.text,
      classification: tutorCls.classification,
    });
    let finalText = reply.text;
    let blockedOutput = false;
    if (!tutorRule.ok || tutorCls.classification.decision === "block") {
      finalText = SAFETY_BLOCKED_FALLBACK("tutor_response");
      blockedOutput = true;
      await recordBlockedGeneration({
        tenantId: session!.tenantId,
        learnerId,
        subjectKind: "tutor_response",
        reason: tutorRule.ok
          ? `Categories: ${tutorCls.classification.categories.join(",")}`
          : `Tutor rule: ${tutorRule.violations.map((v) => v.rule).join(",")}`,
        fallbackResponse: finalText,
      });
      await recordModerationEvent({
        tenantId: session!.tenantId,
        learnerId,
        subjectKind: "tutor_response",
        subjectRefId: null,
        excerpt: reply.text,
        classification: tutorCls.classification,
        injectionSignals: tutorCls.injectionSignals,
        crisisSignals: tutorCls.crisisSignals,
        createdByUserId: null,
      });
    }

    audit(session!, "tutor.reply", requestId, {
      learnerId,
      metadata: {
        turn: priorTurnCount + 1,
        tutorBlocked: blockedOutput ? "1" : "0",
      },
    });
    const replyTurn: Turn = { role: "tutor", text: finalText };
    return ok({ reply: replyTurn, blocked: blockedOutput }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
