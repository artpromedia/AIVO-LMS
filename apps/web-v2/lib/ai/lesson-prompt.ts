/**
 * Shared lesson-plan prompt building blocks.
 *
 * Every real tutor provider (Anthropic, OpenAI, Google) emits the SAME lesson
 * plan from the SAME instructions; only the transport differs. Extracting the
 * system prompt, the per-learner user prompt, and the lenient JSON extraction
 * here keeps the three providers byte-for-byte consistent in what they ask the
 * model for — so a fallback from Claude to GPT to Gemini produces an
 * equivalent plan, not a subtly different one.
 *
 * The deterministic `example` plan (built by `generateLessonPlanWithFallback`)
 * is the single source of the output shape: providers anchor the model to it
 * without importing the deterministic generator directly (enforced by
 * `scripts/lessonrun-audit.mjs`).
 */
import type { TutorGenerationInputs } from "./tutor";

export const LESSON_SYSTEM_PROMPT = [
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

export function buildLessonUserPrompt(input: TutorGenerationInputs, example: unknown): string {
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
export function extractLessonJson(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fenced) return fenced[1].trim();
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) return trimmed.slice(first, last + 1);
  return trimmed;
}
