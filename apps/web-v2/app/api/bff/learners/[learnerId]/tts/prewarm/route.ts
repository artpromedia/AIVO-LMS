import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, failFromUnknown, getRequestId, ok } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import { requireSession, requireLearnerScope } from "@/lib/bff/guards";
import { requireLearnerConsent } from "@/lib/bff/consent-guard";
import { audit } from "@/lib/bff/audit";
import { generateTTS } from "@/lib/db/repos";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ learnerId: string }> };

const bodySchema = z.object({
  items: z
    .array(
      z.object({
        text: z.string().min(1).max(4000),
        contextRefId: z.string().min(1).max(128).optional(),
      }),
    )
    // Prewarm is meant for small batches (a chapter, a lesson). 20 items is
    // plenty and keeps a synchronous handler responsive.
    .min(1)
    .max(20),
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
    const consentErr = await requireLearnerConsent(
      session!,
      learnerId,
      ["child_data_collection"],
      requestId,
    );
    if (consentErr) return consentErr;
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
    const results: {
      contextRefId: string | null;
      assetId: string | null;
      cacheHit: boolean;
      error: string | null;
    }[] = [];
    for (const item of parsed.data.items) {
      try {
        const { job, asset } = await generateTTS({
          tenantId: session!.tenantId,
          learnerId,
          text: item.text,
          voiceId: parsed.data.voiceId,
          languageCode: parsed.data.languageCode,
        });
        results.push({
          contextRefId: item.contextRefId ?? null,
          assetId: asset.id,
          cacheHit: job.status === "cached_hit",
          error: null,
        });
      } catch (e) {
        results.push({
          contextRefId: item.contextRefId ?? null,
          assetId: null,
          cacheHit: false,
          error: e instanceof Error ? e.message : "TTS failed.",
        });
      }
    }
    audit(session!, "tts.prewarm", requestId, {
      learnerId,
      metadata: { items: String(results.length) },
    });
    return ok({ results }, requestId);
  } catch (e) {
    return failFromUnknown(e, requestId);
  }
}
