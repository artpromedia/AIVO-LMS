/**
 * Sprint 11: AI adapter interface for tutor lesson generation.
 *
 * - `TutorProvider` is the swappable contract.
 * - `MockTutorProvider` returns the deterministic plan (always valid).
 * - `generateLessonPlanWithRetry` is the production-shaped entry point:
 *     calls the provider, validates with Zod, repairs/retries on schema
 *     failures, and falls back to the deterministic generator after the
 *     retry budget is exhausted.
 *
 * The real-AI provider lives behind the same interface; we just swap the
 * import. No call site needs to change.
 */
import type {
  CurriculumFocus,
  LearnerBrainProfileState,
  LessonAccommodationSnapshot,
  LessonMasterySnapshot,
  LessonObjectiveTemplate,
  Skill,
  SkillVersion,
  Subject,
} from "@/lib/db/types";
import { GeneratedLessonPlanSchema, type GeneratedLessonPlanInput } from "@/lib/validators/lesson";
import { generateDeterministicLessonPlan } from "@/lib/learner/lesson-plan";
import { logger } from "@/lib/observability/logger";
import { emitDegradation } from "@/lib/observability/degradation";

export const LESSON_PLAN_SCHEMA_VERSION = 1;
export const LESSON_PLAN_MAX_ATTEMPTS = 3;

export type TutorGenerationInputs = {
  learnerName: string;
  brainState: LearnerBrainProfileState;
  subject: Subject;
  skill: Skill;
  /**
   * S26: current SkillVersion + active LessonObjectiveTemplate become the
   * hard scope for generation. Both are optional during transition so older
   * skills without a v1 version still produce a deterministic plan, but the
   * generator should treat them as constraints when present (objective
   * summary + objectives[]).
   */
  skillVersion?: SkillVersion | null;
  objectiveTemplate?: LessonObjectiveTemplate | null;
  mastery: LessonMasterySnapshot;
  accommodations: LessonAccommodationSnapshot;
  /**
   * Phase 1: the learner's active school-week curriculum for this subject, when
   * a parent/teacher uploaded one. When present the generator anchors the
   * lesson (title, intro, worked example, parent summary) to this week's school
   * topic so AIVO teaches in sync with class. Null when there's nothing to sync.
   */
  curriculumFocus?: CurriculumFocus | null;
  source: string;
};

export type TutorProvider = {
  name: "mock" | "ai";
  model: string;
  /**
   * May throw or return malformed JSON — the caller validates.
   *
   * `example` is a schema-valid reference plan the orchestrator supplies so a
   * real provider can anchor the model output to the exact shape WITHOUT
   * importing the deterministic generator itself. Keeping that import contained
   * to this orchestrator is enforced by `scripts/lessonrun-audit.mjs`.
   */
  generate(input: TutorGenerationInputs, example?: unknown): Promise<unknown>;
};

export const MockTutorProvider: TutorProvider = {
  name: "mock",
  model: "deterministic-v1",
  async generate(input) {
    return generateDeterministicLessonPlan(input);
  },
};

export type TutorGenerationResult = {
  plan: GeneratedLessonPlanInput;
  telemetry: {
    provider: "mock" | "ai";
    model: string;
    attempts: number;
    latencyMs: number;
    schemaVersion: number;
  };
};

/**
 * Generate, validate, repair, and fall back. Always returns a valid plan
 * (or throws — but the deterministic fallback is itself validated, so
 * production callers see a plan in every realistic case).
 */
export async function generateLessonPlanWithRetry(
  provider: TutorProvider,
  input: TutorGenerationInputs,
): Promise<TutorGenerationResult> {
  const start = Date.now();
  let lastError: unknown = null;
  // Compute the deterministic plan once: it both anchors the provider's output
  // shape (passed in as the `example`) and is the validated safety-net
  // `fallback` below. This is the single place that reaches the deterministic
  // generator, so real providers never import it.
  const fallback = generateDeterministicLessonPlan(input);
  for (let attempt = 1; attempt <= LESSON_PLAN_MAX_ATTEMPTS; attempt++) {
    try {
      const raw = await provider.generate(input, fallback);
      const parsed = GeneratedLessonPlanSchema.safeParse(raw);
      if (parsed.success) {
        return {
          plan: parsed.data,
          telemetry: {
            provider: provider.name,
            model: provider.model,
            attempts: attempt,
            latencyMs: Date.now() - start,
            schemaVersion: LESSON_PLAN_SCHEMA_VERSION,
          },
        };
      }
      lastError = parsed.error;
      logger.warn(
        { attempt, issues: parsed.error.issues.length, provider: provider.name },
        "[ai/tutor] plan schema mismatch — retrying",
      );
    } catch (e) {
      lastError = e;
      logger.warn(
        { attempt, provider: provider.name, err: e instanceof Error ? e.message : String(e) },
        "[ai/tutor] provider threw — retrying",
      );
    }
  }

  // Deterministic fallback. We treat it as the safety net so the learner
  // ALWAYS gets a usable lesson even when the upstream provider misbehaves.
  logger.error(
    { provider: provider.name, lastError: String(lastError) },
    "[ai/tutor] provider exhausted retries — using deterministic fallback",
  );
  // Only a degradation when a REAL provider failed: the mock provider
  // exhausting retries is impossible-by-construction (it returns the
  // deterministic plan), and dev runs on mock by design.
  if (provider.name === "ai") {
    emitDegradation("lesson_fallback_after_retries", {
      reason: "retries_exhausted",
      provider: provider.model,
      message: `lesson provider ${provider.model} failed ${LESSON_PLAN_MAX_ATTEMPTS} attempts: ${String(lastError).slice(0, 300)}`,
    });
  }
  const validated = GeneratedLessonPlanSchema.parse(fallback);
  return {
    plan: validated,
    telemetry: {
      provider: "mock",
      model: "deterministic-fallback",
      attempts: LESSON_PLAN_MAX_ATTEMPTS,
      latencyMs: Date.now() - start,
      schemaVersion: LESSON_PLAN_SCHEMA_VERSION,
    },
  };
}
