import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import { SAFETY_VALIDATE_PLAN, getActiveSafetyPolicy, recordModerationEvent } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  lessonRunId: z.string().min(1).max(128).optional(),
  hookText: z.string().max(4000).optional(),
  modelingText: z.string().max(8000).optional(),
  guidedPractice: z
    .array(
      z.object({
        prompt: z.string().max(2000).optional(),
        expectedResponse: z.string().max(2000).optional(),
      }),
    )
    .max(20)
    .optional(),
  checksForUnderstanding: z
    .array(z.object({ prompt: z.string().max(2000).optional() }))
    .max(20)
    .optional(),
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
    const result = SAFETY_VALIDATE_PLAN(parsed.data, getActiveSafetyPolicy());
    if (!result.ok) {
      recordModerationEvent({
        tenantId: session!.tenantId,
        learnerId: null,
        subjectKind: "lesson_plan",
        subjectRefId: parsed.data.lessonRunId ?? null,
        excerpt: (parsed.data.hookText ?? "") + " " + (parsed.data.modelingText ?? ""),
        classification: result.classification,
        injectionSignals: [],
        crisisSignals: [],
        createdByUserId: session!.userId,
      });
      audit(session!, "safety.lesson.blocked", requestId, {
        metadata: {
          lessonRunId: parsed.data.lessonRunId ?? null,
          violations: result.violations.join("; "),
        },
      });
    }
    return ok(result, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
