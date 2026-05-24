/**
 * POST /api/speech-eval/evaluate
 *
 * Accepts multipart form data:
 *   - audio: binary audio blob (webm, mp4, ogg …)
 *   - targetText: the prompt/phrase the learner was asked to say
 *   - language: BCP-47 language code (e.g. "en-US", "es-MX")
 *
 * When SPEECH_EVAL_MODE=mock (default), returns realistic mock scores
 * with degraded:true so the learner-surface flow completes end-to-end
 * without Whisper/hosted ASR being wired up.
 *
 * When SPEECH_EVAL_MODE=live the route would invoke a real Whisper
 * endpoint + a phoneme-alignment scorer. That path is stubbed here and
 * gated behind the flag until hosting is provisioned.
 */

import { FastifyInstance } from "fastify";
import type { MultipartFile } from "@fastify/multipart";

export interface EvaluateResult {
  transcript: string;
  scores: {
    pronunciation: number;
    fluency: number;
    perWord?: Array<{ word: string; score: number }>;
  };
  /** true when real ASR/scoring was not available and mock data was used */
  degraded: boolean;
  language: string;
  durationMs?: number;
}

// ── Mock scorer ──────────────────────────────────────────────────────────────

/** Deterministic-ish per-word score derived from word length so the mock
 *  looks plausible across different prompts. */
function mockWordScore(word: string): number {
  const base = 60 + (word.length % 5) * 7;
  return Math.min(100, base + Math.floor(Math.random() * 12));
}

function buildMockResult(targetText: string, language: string): EvaluateResult {
  const words = targetText
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, "")
    .split(/\s+/)
    .filter(Boolean);

  const perWord = words.map((w) => ({ word: w, score: mockWordScore(w) }));
  const pronunciation =
    perWord.length > 0
      ? Math.round(perWord.reduce((s, pw) => s + pw.score, 0) / perWord.length)
      : 72;
  const fluency = Math.min(100, pronunciation + Math.floor(Math.random() * 10) - 3);

  return {
    transcript: targetText, // echo back the target as the mock transcript
    scores: { pronunciation, fluency, perWord },
    degraded: true,
    language,
  };
}

// ── Route registration ───────────────────────────────────────────────────────

function isMockMode(): boolean {
  const val = process.env.SPEECH_EVAL_MODE ?? "mock";
  return val.trim().toLowerCase() !== "live";
}

export function registerEvaluateRoute(app: FastifyInstance) {
  app.post("/api/speech-eval/evaluate", {
    schema: {
      tags: ["SpeechEval"],
      operationId: "speechEvalEvaluate",
      summary: "Evaluate a learner voice recording",
      description:
        "Accepts multipart audio + target text + language. " +
        "When SPEECH_EVAL_MODE=mock (default) returns realistic mock scores with degraded:true.",
      // multipart bodies are parsed by @fastify/multipart; JSON schema only
      // describes the response so the swagger UI is informative.
      response: {
        200: {
          type: "object",
          required: ["transcript", "scores", "degraded", "language"],
          additionalProperties: true,
          properties: {
            transcript: { type: "string" },
            scores: {
              type: "object",
              required: ["pronunciation", "fluency"],
              additionalProperties: true,
              properties: {
                pronunciation: { type: "number" },
                fluency: { type: "number" },
                perWord: {
                  type: "array",
                  items: {
                    type: "object",
                    required: ["word", "score"],
                    properties: {
                      word: { type: "string" },
                      score: { type: "number" },
                    },
                  },
                },
              },
            },
            degraded: { type: "boolean" },
            language: { type: "string" },
            durationMs: { type: "number" },
          },
        },
        400: {
          type: "object",
          required: ["error"],
          additionalProperties: true,
          properties: { error: { type: "string" } },
        },
        503: {
          type: "object",
          required: ["error"],
          additionalProperties: true,
          properties: { error: { type: "string" }, degraded: { type: "boolean" } },
        },
      },
    },
  }, async (request, reply) => {
    // Parse multipart parts
    let audioPart: MultipartFile | undefined;
    let targetText = "";
    let language = "en-US";

    try {
      const parts = (request as any).parts() as AsyncIterable<
        MultipartFile | { type: "field"; fieldname: string; value: string }
      >;
      for await (const part of parts) {
        if ("file" in part) {
          audioPart = part as MultipartFile;
          // Drain the stream so the upload completes
          const chunks: Buffer[] = [];
          for await (const chunk of audioPart.file) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          }
          // attach buffer so live path can use it later
          (audioPart as any)._buf = Buffer.concat(chunks);
        } else {
          const field = part as { type: "field"; fieldname: string; value: string };
          if (field.fieldname === "targetText") targetText = String(field.value ?? "");
          if (field.fieldname === "language") language = String(field.value ?? "en-US");
        }
      }
    } catch (err: any) {
      return reply.code(400).send({ error: `multipart parse error: ${err?.message ?? err}` });
    }

    if (!audioPart) {
      return reply.code(400).send({ error: "Missing required field: audio" });
    }
    if (!targetText.trim()) {
      return reply.code(400).send({ error: "Missing required field: targetText" });
    }

    if (isMockMode()) {
      const result = buildMockResult(targetText, language);
      return reply.send(result);
    }

    // ── Live path (stub — gated behind SPEECH_EVAL_MODE=live) ───────────────
    // TODO: invoke Whisper ASR + phoneme-alignment scorer here once hosted.
    return reply.code(503).send({
      error: "Live ASR not yet configured; set SPEECH_EVAL_MODE=mock to use mock scores",
      degraded: true,
    });
  });
}
