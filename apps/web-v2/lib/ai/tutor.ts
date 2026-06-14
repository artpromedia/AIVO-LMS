/**
 * Sprint 11: AI adapter interface for tutor lesson generation.
 *
 * - `TutorProvider` is the swappable contract.
 * - `MockTutorProvider` returns the deterministic development/test plan.
 * - `generateLessonPlanWithRetry` is the production-shaped entry point:
 *     calls the provider, validates with Zod, and repairs/retries on schema
 *     failures. Real-provider exhaustion raises a generation failure instead
 *     of silently returning deterministic content.
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
  /**
   * Remediation Sprint 05: guided-practice items sourced from the REAL
   * authored content packs for this (subject, grade band), mapped by
   * lib/learner/authored-content.ts. When present the deterministic
   * generator serves THESE as the practice items, and the AI provider is
   * instructed to use them as its source material — authoring a pack now
   * changes what the learner actually sees. Empty/undefined → the domain
   * template builders are the fallback.
   */
  authoredItems?: GeneratedLessonPlanInput["guidedPractice"];
  source: string;
};

export type TutorProvider = {
  name: "mock" | "ai" | "openai" | "google";
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
    provider: "mock" | "ai" | "openai" | "google";
    model: string;
    attempts: number;
    latencyMs: number;
    schemaVersion: number;
  };
};

/**
 * Run one provider's full retry budget. Returns the validated plan on success,
 * or the last error after `LESSON_PLAN_MAX_ATTEMPTS` failed attempts. Kept
 * separate so the chain orchestrator stays simple (one decision per provider).
 */
async function runProviderWithRetry(
  provider: TutorProvider,
  input: TutorGenerationInputs,
  example: unknown,
): Promise<
  | { ok: true; plan: GeneratedLessonPlanInput; attempts: number }
  | { ok: false; error: unknown }
> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= LESSON_PLAN_MAX_ATTEMPTS; attempt++) {
    try {
      const raw = await provider.generate(input, example);
      const parsed = GeneratedLessonPlanSchema.safeParse(raw);
      if (parsed.success) return { ok: true, plan: parsed.data, attempts: attempt };
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
  return { ok: false, error: lastError };
}

/**
 * Final policy once every provider in the chain is exhausted: production throws
 * an honest generation failure; development/test serve the validated
 * deterministic plan so suites run without network credentials.
 */
function resolveExhaustedChain(
  chain: readonly TutorProvider[],
  fallback: GeneratedLessonPlanInput,
  lastError: unknown,
  start: number,
): TutorGenerationResult {
  const realProviders = chain.filter((p) => p.name !== "mock");
  logger.error(
    { providers: chain.map((p) => p.name), lastError: String(lastError) },
    "[ai/tutor] all providers exhausted retries",
  );
  if (realProviders.length > 0) {
    const names = realProviders.map((p) => p.name).join(", ");
    emitDegradation("lesson_fallback_after_retries", {
      reason: "retries_exhausted",
      provider: realProviders.map((p) => p.model).join(","),
      message:
        `all lesson providers [${names}] failed ${LESSON_PLAN_MAX_ATTEMPTS} attempts each; ` +
        (process.env.NODE_ENV === "production"
          ? `no deterministic learner-facing fallback was served: ${String(lastError).slice(0, 300)}`
          : `served deterministic non-production fallback: ${String(lastError).slice(0, 300)}`),
    });
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        `lesson providers [${names}] failed after ${LESSON_PLAN_MAX_ATTEMPTS} attempts each`,
      );
    }
  }
  const validated = GeneratedLessonPlanSchema.parse(fallback);
  return {
    plan: validated,
    telemetry: {
      provider: "mock",
      model: "deterministic-non-production-fallback",
      attempts: LESSON_PLAN_MAX_ATTEMPTS,
      latencyMs: Date.now() - start,
      schemaVersion: LESSON_PLAN_SCHEMA_VERSION,
    },
  };
}

/**
 * Generate across an ORDERED provider chain (primary first, fallbacks after).
 *
 * Each provider gets the full `LESSON_PLAN_MAX_ATTEMPTS` retry budget; when one
 * is exhausted the orchestrator fails over to the next provider in the chain
 * (Anthropic → OpenAI → Google by default) and pages a `lesson_provider_failover`
 * degradation so the silent-primary-down case is visible. Only when EVERY real
 * provider is exhausted does it apply the final policy (`resolveExhaustedChain`):
 * production throws; development/test serve the deterministic plan.
 *
 * An empty chain (no configured keys) is treated as development/test and serves
 * the deterministic plan; a chain of `[MockTutorProvider]` is the dev default.
 */
export async function generateLessonPlanWithFallback(
  providers: readonly TutorProvider[],
  input: TutorGenerationInputs,
): Promise<TutorGenerationResult> {
  const start = Date.now();
  // Compute the deterministic reference once: it anchors every provider's
  // output shape (passed in as the `example`) and is the development/test
  // safety net. Real providers never import the generator directly.
  const fallback = generateDeterministicLessonPlan(input);
  const chain = providers.length > 0 ? providers : [MockTutorProvider];
  let lastError: unknown = null;

  for (let p = 0; p < chain.length; p++) {
    const provider = chain[p];
    const result = await runProviderWithRetry(provider, input, fallback);
    if (result.ok) {
      return {
        plan: result.plan,
        telemetry: {
          provider: provider.name,
          model: provider.model,
          attempts: result.attempts,
          latencyMs: Date.now() - start,
          schemaVersion: LESSON_PLAN_SCHEMA_VERSION,
        },
      };
    }
    lastError = result.error;

    // Fail over to the next real provider, surfacing the primary-down event
    // (dedups per (event, reason) so a hot loop cannot alert-storm).
    const next = chain[p + 1];
    if (next && next.name !== "mock") {
      logger.warn(
        { from: provider.name, to: next.name, lastError: String(lastError) },
        "[ai/tutor] provider exhausted — failing over to next provider",
      );
      emitDegradation("lesson_provider_failover", {
        reason: "retries_exhausted",
        provider: provider.model,
        message:
          `lesson provider ${provider.name} (${provider.model}) failed ` +
          `${LESSON_PLAN_MAX_ATTEMPTS} attempts; failing over to ${next.name} ` +
          `(${next.model}): ${String(lastError).slice(0, 200)}`,
      });
    }
  }

  return resolveExhaustedChain(chain, fallback, lastError, start);
}

/**
 * Single-provider entry point (backward-compatible wrapper around
 * `generateLessonPlanWithFallback`). Most call sites should pass the ordered
 * chain from `getTutorProviderChain()`; this remains for injected-provider
 * tests and any caller that genuinely wants exactly one provider.
 */
export async function generateLessonPlanWithRetry(
  provider: TutorProvider,
  input: TutorGenerationInputs,
): Promise<TutorGenerationResult> {
  return generateLessonPlanWithFallback([provider], input);
}
