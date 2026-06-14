/**
 * Real AI tutor provider — Anthropic Claude.
 *
 * Implements the same `TutorProvider` contract as `MockTutorProvider`, so it
 * drops into `generateLessonPlanWithRetry` unchanged: the harness validates
 * the returned JSON against `GeneratedLessonPlanSchema` and repairs/retries
 * on mismatch. Production failures surface as typed generation failures rather
 * than silently teaching from a deterministic plan.
 *
 * Selection is config-driven via `getTutorProvider()`: a real Claude provider
 * when `AI_PROVIDER=anthropic` and a key is present, else the development
 * provider. Production refuses a missing real provider/key.
 *
 * The client is injectable so unit tests can run without network/credentials;
 * a live conformance test exercises the real API only when ANTHROPIC_API_KEY
 * is set.
 */
import Anthropic from "@anthropic-ai/sdk";
import { serverEnv } from "@/lib/env";
import { emitDegradation } from "@/lib/observability/degradation";
import { MockTutorProvider, type TutorProvider } from "./tutor";
import { LESSON_SYSTEM_PROMPT, buildLessonUserPrompt, extractLessonJson } from "./lesson-prompt";

// Default to the most capable model; adaptive thinking lets Claude scale
// reasoning to the learner's profile complexity.
export const ANTHROPIC_TUTOR_MODEL = "claude-opus-4-8";

export function createAnthropicTutorProvider(client: Anthropic): TutorProvider {
  return {
    name: "ai",
    model: ANTHROPIC_TUTOR_MODEL,
    // `example` is the schema-valid reference plan supplied by the orchestrator
    // (`generateLessonPlanWithRetry`); the provider anchors Claude's output to
    // it without importing the deterministic generator directly.
    async generate(input, example) {
      const message = await client.messages.create({
        model: ANTHROPIC_TUTOR_MODEL,
        max_tokens: 16000,
        thinking: { type: "adaptive" },
        // Stable system prompt is cached across requests (prefix match); the
        // volatile per-learner inputs live in the user turn, after the cache
        // breakpoint, so the cache actually hits.
        system: [{ type: "text", text: LESSON_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: buildLessonUserPrompt(input, example) }],
      });
      const textBlock = message.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        throw new Error("anthropic-tutor: response contained no text block");
      }
      // The caller (generateLessonPlanWithFallback) validates against the Zod
      // schema and retries/fails over — so a parse here that yields the wrong
      // shape is recovered, not fatal.
      return JSON.parse(extractLessonJson(textBlock.text));
    },
  };
}

let cachedProvider: TutorProvider | null = null;
/**
 * Resolve the tutor provider from configuration. Real Claude when
 * `AI_PROVIDER=anthropic` and a key is present. Development and test may use
 * the deterministic provider; production raises a typed configuration failure
 * so lesson-start UI can show an honest generation blocker.
 */
export function getTutorProvider(): TutorProvider {
  if (serverEnv.AI_PROVIDER === "anthropic" && serverEnv.ANTHROPIC_API_KEY) {
    if (!cachedProvider) {
      cachedProvider = createAnthropicTutorProvider(
        new Anthropic({ apiKey: serverEnv.ANTHROPIC_API_KEY }),
      );
    }
    return cachedProvider;
  }
  if (process.env.NODE_ENV === "production") {
    emitDegradation("lesson_provider_mock_in_prod", {
      reason: "missing_api_key",
      provider: serverEnv.AI_PROVIDER,
      message:
        `AI_PROVIDER=${serverEnv.AI_PROVIDER} but no usable tutor provider/key resolved.`,
    });
    throw new Error(
      `Lesson generation requires a configured provider; AI_PROVIDER=${serverEnv.AI_PROVIDER} has no usable API key/provider.`,
    );
  }
  return MockTutorProvider;
}

/** Test-only: clear the memoized provider so env changes take effect. */
export function resetTutorProviderForTest(): void {
  cachedProvider = null;
}
