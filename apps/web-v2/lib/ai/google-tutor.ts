/**
 * Real AI tutor provider — Google Gemini (second fallback after OpenAI).
 *
 * Implements the same `TutorProvider` contract as the Anthropic and OpenAI
 * providers, so it drops into the `generateLessonPlanWithFallback` chain
 * unchanged. Uses the Generative Language REST endpoint via `fetch` (no SDK —
 * the same `generativelanguage.googleapis.com` host the boot probe already
 * verifies), so the web-v2 dependency surface stays unchanged.
 *
 * `responseMimeType: "application/json"` makes Gemini return a JSON document;
 * the orchestrator still validates it against `GeneratedLessonPlanSchema` and
 * fails over on mismatch, so shape drift is recovered, not fatal.
 */
import { serverEnv } from "@/lib/env";
import type { TutorProvider } from "./tutor";
import { LESSON_SYSTEM_PROMPT, buildLessonUserPrompt, extractLessonJson } from "./lesson-prompt";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
/** Configurable so the model can be rolled forward without a code change. */
export const GOOGLE_TUTOR_MODEL = serverEnv.GOOGLE_TUTOR_MODEL ?? "gemini-2.0-flash";

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
};

export function createGoogleTutorProvider(opts: {
  apiKey: string;
  model?: string;
  fetchImpl?: typeof fetch;
}): TutorProvider {
  const model = opts.model ?? GOOGLE_TUTOR_MODEL;
  const doFetch = opts.fetchImpl ?? globalThis.fetch;
  return {
    name: "google",
    model,
    async generate(input, example) {
      const url = `${GEMINI_API_BASE}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(opts.apiKey)}`;
      const res = await doFetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          // Gemini takes the system prompt as a dedicated systemInstruction.
          systemInstruction: { parts: [{ text: LESSON_SYSTEM_PROMPT }] },
          contents: [{ role: "user", parts: [{ text: buildLessonUserPrompt(input, example) }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`google-tutor: ${res.status} ${detail.slice(0, 200)}`);
      }
      const data = (await res.json()) as GeminiResponse;
      const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("");
      if (!text) {
        throw new Error("google-tutor: response contained no candidate text");
      }
      // The caller (generateLessonPlanWithFallback) validates + fails over.
      return JSON.parse(extractLessonJson(text));
    },
  };
}
