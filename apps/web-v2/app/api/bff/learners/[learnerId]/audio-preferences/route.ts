import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireLearnerScope } from "@/lib/bff/guards";
import { audit } from "@/lib/bff/audit";
import {
  getLearnerVoicePreference,
  upsertLearnerVoicePreference,
} from "@/lib/db/repos";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ learnerId: string }> };

const patchSchema = z.object({
  voiceId: z
    .enum(["warm_female", "warm_male", "calm_neutral", "kid_friendly", "narrator_low", "narrator_high"])
    .optional(),
  speed: z.number().min(0.5).max(2).optional(),
  enabled: z.boolean().optional(),
  captionsAlways: z.boolean().optional(),
});

export async function GET(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const scopeErr = requireLearnerScope(session!, learnerId, requestId);
    if (scopeErr) return scopeErr;
    const pref = getLearnerVoicePreference(learnerId);
    return ok({ preference: pref }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}

export async function PATCH(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const scopeErr = requireLearnerScope(session!, learnerId, requestId);
    if (scopeErr) return scopeErr;
    // Only parents and admins may toggle `enabled`; learners can change voice
    // and speed within the constraints their parent already accepted.
    let body: unknown = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return fail(
        { ...ERRORS.VALIDATION_FAILED, message: parsed.error.issues[0]?.message ?? "Invalid body." },
        requestId,
      );
    }
    if (parsed.data.enabled !== undefined && session!.role === "learner") {
      return fail(
        { ...ERRORS.FORBIDDEN_ROLE, message: "Only a parent or admin can toggle read-aloud." },
        requestId,
      );
    }
    const pref = upsertLearnerVoicePreference({
      learnerId,
      tenantId: session!.tenantId,
      ...parsed.data,
    });
    audit(session!, "audio.prefs.updated", requestId, {
      learnerId,
      metadata: {
        enabled: String(pref.enabled),
        voiceId: pref.voiceId,
        speed: String(pref.speed),
      },
    });
    return ok({ preference: pref }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
