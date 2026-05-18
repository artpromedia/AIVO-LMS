import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireLearnerScope } from "@/lib/bff/guards";
import { requireLearnerConsent } from "@/lib/bff/consent-guard";
import { audit } from "@/lib/bff/audit";
import { generateTTS, getLearnerVoicePreference, recordReadAloudUsage } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ learnerId: string }> };

const bodySchema = z.object({
  text: z.string().min(1).max(4000),
  contextKind: z.enum(["baseline_question", "lesson_step", "homework_message", "ui_label"]),
  contextRefId: z.string().min(1).max(128).nullable().optional(),
  voiceId: z
    .enum([
      "warm_female",
      "warm_male",
      "calm_neutral",
      "kid_friendly",
      "narrator_low",
      "narrator_high",
    ])
    .optional(),
  speed: z.number().min(0.5).max(2).optional(),
  languageCode: z.string().min(2).max(16).optional(),
});

export async function POST(req: Request, { params }: Params): Promise<NextResponse> {
  const requestId = getRequestId(req);
  const { learnerId } = await params;
  try {
    const { session, response } = await requireSession(req, requestId);
    if (response) return response;
    const scopeErr = requireLearnerScope(session!, learnerId, requestId);
    if (scopeErr) return scopeErr;
    const consentErr = requireLearnerConsent(
      session!,
      learnerId,
      ["child_data_collection"],
      requestId,
    );
    if (consentErr) return consentErr;
    const pref = getLearnerVoicePreference(learnerId);
    if (pref && !pref.enabled) {
      return fail(
        { ...ERRORS.PRECONDITION_FAILED, message: "Read-aloud is disabled for this learner." },
        requestId,
      );
    }
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
    try {
      const { job, asset } = await generateTTS({
        tenantId: session!.tenantId,
        learnerId,
        text: parsed.data.text,
        voiceId: parsed.data.voiceId,
        languageCode: parsed.data.languageCode,
        speed: parsed.data.speed,
      });
      const cacheHit = job.status === "cached_hit";
      recordReadAloudUsage({
        tenantId: session!.tenantId,
        learnerId,
        audioAssetId: asset.id,
        contextKind: parsed.data.contextKind,
        contextRefId: parsed.data.contextRefId ?? null,
        cacheHit,
        // On a cache hit no provider call was made so the playback cost is 0.
        costMicroUsd: cacheHit ? 0 : asset.costMicroUsd,
      });
      audit(session!, "tts.generate", requestId, {
        learnerId,
        metadata: {
          assetId: asset.id,
          cacheHit: cacheHit ? "1" : "0",
          chars: String(parsed.data.text.length),
        },
      });
      return ok({ job, asset }, requestId);
    } catch (e) {
      // Failed TTS does not block lesson completion — we return a structured
      // error that the player can detect and gracefully degrade to transcript.
      audit(session!, "tts.failed", requestId, {
        learnerId,
        metadata: { error: e instanceof Error ? e.message : "unknown" },
      });
      return fail(
        {
          ...ERRORS.UPSTREAM_UNAVAILABLE,
          message: "TTS generation failed; falling back to transcript.",
          retryable: true,
        },
        requestId,
      );
    }
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
