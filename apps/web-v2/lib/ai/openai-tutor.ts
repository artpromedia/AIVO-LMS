/**
 * Real AI tutor provider — OpenAI (first fallback after Anthropic).
 *
 * Implements the same `TutorProvider` contract as the Anthropic and Google
 * providers, so it drops into the `generateLessonPlanWithFallback` chain
 * unchanged. Uses the Chat Completions REST endpoint via `fetch` (no SDK —
 * mirroring `lib/tts/provider.ts`'s OpenAI adapter), which keeps the web-v2
 * dependency surface unchanged (no lockfile churn) and the client trivially
 * injectable for tests.
 *
 * JSON mode (`response_format: { type: "json_object" }`) makes the model return
 * a single JSON object; the orchestrator still validates it against
 * `GeneratedLessonPlanSchema` and fails over on mismatch, so a stray fence or
 * shape drift is recovered, not fatal.
 */
import { serverEnv } from "@/lib/env";
import type { TutorProvider } from "./tutor";
import { LESSON_SYSTEM_PROMPT, buildLessonUserPrompt, extractLessonJson } from "./lesson-prompt";

const OPENAI_CHAT_ENDPOINT = "https://api.openai.com/v1/chat/completions";
/** Configurable so the model can be rolled forward without a code change. */
export const OPENAI_TUTOR_MODEL = serverEnv.OPENAI_TUTOR_MODEL ?? "gpt-5.5";

type OpenAIChatResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
};

export function createOpenAITutorProvider(opts: {
  apiKey: string;
  model?: string;
  fetchImpl?: typeof fetch;
}): TutorProvider {
  const model = opts.model ?? OPENAI_TUTOR_MODEL;
  const doFetch = opts.fetchImpl ?? globalThis.fetch;
  return {
    name: "openai",
    model,
    async generate(input, example) {
      const res = await doFetch(OPENAI_CHAT_ENDPOINT, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${opts.apiKey}`,
        },
        body: JSON.stringify({
          model,
          // Single JSON object out; the system prompt already forbids prose.
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: LESSON_SYSTEM_PROMPT },
            { role: "user", content: buildLessonUserPrompt(input, example) },
          ],
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`openai-tutor: ${res.status} ${detail.slice(0, 200)}`);
      }
      const data = (await res.json()) as OpenAIChatResponse;
      const text = data.choices?.[0]?.message?.content;
      if (!text) {
        throw new Error("openai-tutor: response contained no message content");
      }
      // The caller (generateLessonPlanWithFallback) validates + fails over.
      return JSON.parse(extractLessonJson(text));
    },
  };
}
