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
  "- Practice items may carry an optional `surface` object choosing the",
  "  interactive surface. When the reference example uses one (e.g.",
  '  {"surfaceType":"number_line","numberLine":{"min":0,"max":8,"step":1}}),',
  "  keep the same surfaceType for items where it fits and make its spec match",
  "  YOUR item's content — a number_line range MUST include the expected answer",
  "  and every numeric choice. Omit `surface` entirely when no interactive",
  "  surface fits the item; never invent surfaceType values not in the example.",
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
    input.authoredItems && input.authoredItems.length > 0
      ? "AUTHORED SOURCE ACTIVITIES — the curriculum team authored these for this skill/grade. " +
        "Base your guidedPractice on them: keep each activity's skill intent, answer fidelity, " +
        "and surface object intact; adapt only the wording to the learner's profile.\n" +
        JSON.stringify(input.authoredItems, null, 2)
      : "",
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
