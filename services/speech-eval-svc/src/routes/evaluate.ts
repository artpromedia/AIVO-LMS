/**
 * POST /api/speech-eval/evaluate
 *
 * Accepts multipart form data:
 *   - audio: binary audio blob (webm, mp4, ogg …)
 *   - targetText: the prompt/phrase the learner was asked to say
 *   - language: BCP-47 language code (e.g. "en-US", "es-MX")
 *
 * The provider is selected by `SPEECH_EVAL_PROVIDER` via the factory in
 * `src/providers/factory.ts`. Production refuses to boot with the mock
 * provider. Dev/test default to mock so the learner-surface flow
 * completes end-to-end without external ASR credentials.
 */

import { FastifyInstance } from "fastify";
import type { MultipartFile } from "@fastify/multipart";
import type { EvalResult } from "../providers/index.js";
import { getSpeechEvalProvider } from "../providers/factory.js";

export type EvaluateResult = EvalResult;

export function registerEvaluateRoute(app: FastifyInstance) {
  app.post(
    "/api/speech-eval/evaluate",
    {
      schema: {
        tags: ["SpeechEval"],
        operationId: "speechEvalEvaluate",
        summary: "Evaluate a learner voice recording",
        description:
          "Accepts multipart audio + target text + language. The active " +
          "ASR provider is configured via SPEECH_EVAL_PROVIDER " +
          "(whisper | azure | deepgram | mock). Mock returns deterministic " +
          "heuristic scores with degraded:true.",
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
          502: {
            type: "object",
            required: ["error"],
            additionalProperties: true,
            properties: { error: { type: "string" }, degraded: { type: "boolean" } },
          },
        },
      },
    },
    async (request, reply) => {
      let audioPart: MultipartFile | undefined;
      let audioBuffer: Buffer | undefined;
      let targetText = "";
      let language = "en-US";

      try {
        const parts = (request as any).parts() as AsyncIterable<
          MultipartFile | { type: "field"; fieldname: string; value: string }
        >;
        for await (const part of parts) {
          if ("file" in part) {
            audioPart = part as MultipartFile;
            const chunks: Buffer[] = [];
            for await (const chunk of audioPart.file) {
              chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            }
            audioBuffer = Buffer.concat(chunks);
          } else {
            const field = part as { type: "field"; fieldname: string; value: string };
            if (field.fieldname === "targetText") targetText = String(field.value ?? "");
            if (field.fieldname === "language") language = String(field.value ?? "en-US");
          }
        }
      } catch (err: any) {
        return reply.code(400).send({ error: `multipart parse error: ${err?.message ?? err}` });
      }

      if (!audioPart || !audioBuffer) {
        return reply.code(400).send({ error: "Missing required field: audio" });
      }
      if (!targetText.trim()) {
        return reply.code(400).send({ error: "Missing required field: targetText" });
      }

      try {
        const provider = getSpeechEvalProvider();
        const result = await provider.evaluate(audioBuffer, targetText, {
          language,
          contentType: audioPart.mimetype,
        });
        return reply.send(result);
      } catch (err: any) {
        request.log?.error?.({ err }, "speech-eval provider failed");
        return reply.code(502).send({
          error: `Speech evaluation provider error: ${err?.message ?? "unknown"}`,
          degraded: true,
        });
      }
    },
  );
}
