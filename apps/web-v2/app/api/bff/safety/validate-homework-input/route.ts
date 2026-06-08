import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireLearnerScope } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import {
  SAFETY_CLASSIFY,
  SAFETY_SANITIZE,
  getActiveSafetyPolicy,
  recordHomeworkInputAudit,
  recordModerationEvent,
} from "@/lib/db/repos";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  text: z.string().min(1).max(8000),
  learnerId: z.string().min(1).max(64),
  homeworkSessionId: z.string().min(1).max(128),
});

export async function POST(req: Request): Promise<NextResponse> {
  const requestId = getRequestId(req);
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    let body: unknown = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return fail(
        {
          ...ERRORS.VALIDATION_FAILED,
          message: parsed.error.issues[0]?.message ?? "Invalid body.",
        },
        requestId,
      );
    }
    // Authorization: the learnerId in the body must be one this session is
    // allowed to act on. Without this, an authenticated parent could write
    // homework-input audit + moderation rows against an unrelated learner.
    const scopeErr = await requireLearnerScope(session!, parsed.data.learnerId, requestId);
    if (scopeErr) return scopeErr;
    const sanitized = SAFETY_SANITIZE(parsed.data.text);
    const result = SAFETY_CLASSIFY(sanitized.cleaned, {
      subjectKind: "homework_input",
      policy: await getActiveSafetyPolicy(),
    });
    await recordHomeworkInputAudit({
      tenantId: session!.tenantId,
      learnerId: parsed.data.learnerId,
      homeworkSessionId: parsed.data.homeworkSessionId,
      rawExcerpt: parsed.data.text,
      sanitizedExcerpt: sanitized.cleaned,
      classification: result.classification,
      piiRedacted: sanitized.piiRedacted,
    });
    if (result.classification.decision !== "allow" || sanitized.injectionStripped) {
      await recordModerationEvent({
        tenantId: session!.tenantId,
        learnerId: parsed.data.learnerId,
        subjectKind: "homework_input",
        subjectRefId: parsed.data.homeworkSessionId,
        excerpt: parsed.data.text,
        classification: result.classification,
        injectionSignals: result.injectionSignals,
        crisisSignals: result.crisisSignals,
        createdByUserId: session!.userId,
      });
      audit(session!, "safety.homework.flagged", requestId, {
        learnerId: parsed.data.learnerId,
        metadata: {
          sessionId: parsed.data.homeworkSessionId,
          decision: result.classification.decision,
          piiRedacted: sanitized.piiRedacted ? "1" : "0",
          injectionStripped: sanitized.injectionStripped ? "1" : "0",
        },
      });
    }
    return ok(
      {
        sanitized: sanitized.cleaned,
        piiRedacted: sanitized.piiRedacted,
        injectionStripped: sanitized.injectionStripped,
        classification: result.classification,
        injectionSignals: result.injectionSignals,
        crisisSignals: result.crisisSignals,
      },
      requestId,
    );
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
