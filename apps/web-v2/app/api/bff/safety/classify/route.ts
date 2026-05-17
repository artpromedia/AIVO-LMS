import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireLearnerScope } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import {
  SAFETY_CLASSIFY,
  getActiveSafetyPolicy,
  recordModerationEvent,
} from "@/lib/db/repos";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  text: z.string().min(1).max(8000),
  subjectKind: z.enum([
    "tutor_response",
    "lesson_plan",
    "homework_input",
    "user_message",
    "uploaded_text",
  ]),
  learnerId: z.string().min(1).max(64).nullable().optional(),
  subjectRefId: z.string().min(1).max(128).nullable().optional(),
  record: z.boolean().optional(),
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
        { ...ERRORS.VALIDATION_FAILED, message: parsed.error.issues[0]?.message ?? "Invalid body." },
        requestId,
      );
    }
    // If the caller asserts a learnerId, they must be authorized for it; this
    // prevents one authenticated user from poisoning another learner's
    // moderation audit log inside the same tenant.
    if (parsed.data.learnerId) {
      const scopeErr = requireLearnerScope(session!, parsed.data.learnerId, requestId);
      if (scopeErr) return scopeErr;
    }
    const result = SAFETY_CLASSIFY(parsed.data.text, {
      subjectKind: parsed.data.subjectKind,
      policy: getActiveSafetyPolicy(),
    });
    let eventId: string | null = null;
    if (parsed.data.record !== false && result.classification.decision !== "allow") {
      const rec = recordModerationEvent({
        tenantId: session!.tenantId,
        learnerId: parsed.data.learnerId ?? null,
        subjectKind: parsed.data.subjectKind,
        subjectRefId: parsed.data.subjectRefId ?? null,
        excerpt: parsed.data.text,
        classification: result.classification,
        injectionSignals: result.injectionSignals,
        crisisSignals: result.crisisSignals,
        createdByUserId: session!.userId,
      });
      eventId = rec.event.id;
      audit(session!, "safety.classify", requestId, {
        learnerId: parsed.data.learnerId ?? undefined,
        metadata: {
          eventId,
          decision: result.classification.decision,
          categories: result.classification.categories.join(","),
        },
      });
    }
    return ok({ ...result, eventId }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
