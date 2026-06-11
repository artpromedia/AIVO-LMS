/**
 * Real AI tutor provider — Anthropic Claude.
 *
 * Implements the same `TutorProvider` contract as `MockTutorProvider`, so it
 * drops into `generateLessonPlanWithRetry` unchanged: the harness validates
 * the returned JSON against `GeneratedLessonPlanSchema`, repairs/retries on
 * mismatch, and falls back to the deterministic plan if the model misbehaves.
 * That safety net is why this provider can return raw `unknown` and let the
 * caller enforce the schema.
 *
 * Selection is config-driven via `getTutorProvider()`: a real Claude provider
 * when `AI_PROVIDER=anthropic` and a key is present, else the deterministic
 * mock. Production refuses `AI_PROVIDER=mock` (lib/env.ts + the release gate),
 * so a prod deploy lands on the real provider here.
 *
 * The client is injectable so unit tests can run without network/credentials;
 * a live conformance test exercises the real API only when ANTHROPIC_API_KEY
 * is set.
 */
import Anthropic from "@anthropic-ai/sdk";
import { serverEnv } from "@/lib/env";
import { emitDegradation } from "@/lib/observability/degradation";
import { MockTutorProvider, type TutorProvider, type TutorGenerationInputs } from "./tutor";

// Default to the most capable model; adaptive thinking lets Claude scale
// reasoning to the learner's profile complexity.
export const ANTHROPIC_TUTOR_MODEL = "claude-opus-4-8";

const SYSTEM_PROMPT = [
  "You are AIVO's adaptive lesson-plan generator for neurodivergent K–12 learners.",
  "You produce a single lesson plan as JSON for AIVO's learner runtime.",
  "",
  "Hard requirements:",
  "- Output ONLY a JSON object. No prose, no commentary, no markdown code fences.",
  "- The JSON MUST have exactly the same keys and value types (and the same enum",
  "  values) as the reference example given in the user message — identical shape.",
  "- Replace the example's content with original, pedagogically sound material",
  "  tailored to the learner's brain profile, current mastery, and accommodations.",
  "  When a school-week curriculum focus is provided, anchor the lesson to it so",
  "  AIVO teaches in sync with the learner's class.",
  "- Honor accommodations and sensory/regulation needs. Keep the voice warm,",
  "  concrete, and calm. Keep step counts and durations realistic for the",
  "  difficulty. Never include unsafe, off-topic, or age-inappropriate content.",
].join("\n");

function buildUserPrompt(input: TutorGenerationInputs, example: unknown): string {
  return [
    `Generate an AIVO lesson plan for learner "${input.learnerName}".`,
    `Subject: ${JSON.stringify(input.subject)}`,
    `Skill: ${JSON.stringify(input.skill)}`,
    input.skillVersion ? `Skill version: ${JSON.stringify(input.skillVersion)}` : "",
    input.objectiveTemplate ? `Objective template: ${JSON.stringify(input.objectiveTemplate)}` : "",
    `Mastery snapshot: ${JSON.stringify(input.mastery)}`,
    `Accommodations: ${JSON.stringify(input.accommodations)}`,
    `Learner brain profile: ${JSON.stringify(input.brainState)}`,
    input.curriculumFocus
      ? `This week's school curriculum focus (teach in sync): ${JSON.stringify(input.curriculumFocus)}`
      : "No school curriculum upload — teach the skill on its own.",
    "",
    "Return JSON with EXACTLY this shape (same keys and value types), with original content tailored to the above:",
    JSON.stringify(example, null, 2),
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Tolerate an accidental ```json fence or surrounding prose. */
function extractJson(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fenced) return fenced[1].trim();
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) return trimmed.slice(first, last + 1);
  return trimmed;
}

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
        system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: buildUserPrompt(input, example) }],
      });
      const textBlock = message.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        throw new Error("anthropic-tutor: response contained no text block");
      }
      // The caller (generateLessonPlanWithRetry) validates against the Zod
      // schema and retries/falls back — so a parse here that yields the wrong
      // shape is recovered, not fatal.
      return JSON.parse(extractJson(textBlock.text));
    },
  };
}

let cachedProvider: TutorProvider | null = null;
let mockInProdAlerted = false;

/**
 * Resolve the tutor provider from configuration. Real Claude when
 * `AI_PROVIDER=anthropic` and a key is present; deterministic mock otherwise.
 *
 * Wave A (G2): in the production runtime, resolving the mock while
 * AI_PROVIDER names a real provider is the silent-misconfig class this
 * release hunts — the boot probe (lib/boot/llm-config-probe.ts) should
 * have refused startup, but if a key is rotated out from under a running
 * process this is the last line that notices. Page once per process
 * (emitDegradation also dedups per-hour across the fleet).
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
  if (
    serverEnv.AI_PROVIDER !== "mock" &&
    process.env.NODE_ENV === "production" &&
    !mockInProdAlerted
  ) {
    mockInProdAlerted = true;
    emitDegradation("lesson_provider_mock_in_prod", {
      reason: "missing_api_key",
      provider: serverEnv.AI_PROVIDER,
      message:
        `AI_PROVIDER=${serverEnv.AI_PROVIDER} but no usable API key/provider ` +
        "implementation resolved — every lesson plan is the deterministic template.",
    });
  }
  return MockTutorProvider;
}

/** Test-only: clear the memoized provider so env changes take effect. */
export function resetTutorProviderForTest(): void {
  cachedProvider = null;
  mockInProdAlerted = false;
}
