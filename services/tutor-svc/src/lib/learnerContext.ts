/**
 * Generic `LearnerContext` builder for the declarative tutor runtime.
 *
 * The context is the union of every learner-shaped fact the runtime
 * needs to deliver a session adapted "like a human tutor would":
 *
 *   - `functioningLevel`  — from `learnerFunctioningLevels` (or Brain
 *                           `functioning_level_profile.level`).
 *   - `masteryRecords`    — from the existing mastery store.
 *   - `recentOutcomes`    — last N answer outcomes, used by scaffolding.
 *   - `recentlyCovered`   — skills already practised this session/day.
 *   - `interestProfile`   — special-interest signals from caregiver
 *                           intake / engagement / IEP.
 *
 * The fields are intentionally accepted as plain inputs (not pulled
 * from a DB connection) so the builder is pure, testable, and reusable
 * by any host — the route layer is responsible for fetching from each
 * underlying store and handing the bag here.
 *
 * IEP goals and sensory-profile cautions ride alongside the
 * `interestProfile.signals` polarity field — a `-1` polarity short-
 * circuits theming for that interest, which is the lowest-risk way to
 * carry trauma / sensory cautions through to the runtime today. Richer
 * sensory profile wiring lands when the SensoryProvider exposes a
 * server-side accessor.
 */
import type { LearnerContext, TutorDefinition, TutorFunctioningLevel } from "@aivo/tutor-runtime";
import type { AnswerOutcome, MasteryRecord } from "@aivo/pedagogy";
import type { GradeBand } from "@aivo/skill-graphs";
import type { LearnerInterestProfile } from "@aivo/special-interest-engine";

const FUNCTIONING_LEVELS: ReadonlyArray<TutorFunctioningLevel> = [
  "STANDARD",
  "SUPPORTED",
  "LOW_VERBAL",
  "NON_VERBAL",
  "PRE_SYMBOLIC",
];

const GRADE_BANDS: ReadonlyArray<GradeBand> = [
  "PRE_K",
  "K",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
  "ADULT",
];

/** Inputs accepted by `buildLearnerContext`. Every field is optional
 *  except `learnerId` so the route can supply whatever it has loaded. */
export interface LearnerContextInputs {
  learnerId: string;
  /** Functioning level from `learnerFunctioningLevels` table, Brain
   *  state, or JWT claim. Falls back to `STANDARD` when missing. */
  functioningLevel?: string | null;
  /** Mastery records from `mastery_records` (or equivalent). */
  masteryRecords?: readonly MasteryRecord[];
  /** Recent `AnswerOutcome` history — most recent last. */
  recentOutcomes?: readonly AnswerOutcome[];
  /** Skills covered earlier today (excluded from retrieval candidates). */
  recentlyCovered?: readonly string[];
  /** Special-interest profile (caregiver intake, engagement, IEP). */
  interestProfile?: LearnerInterestProfile;
  /**
   * Learner's grade band. When supplied, the runtime checks the tutor's
   * `coverageMatrix` and refuses to plan the session if the band is not
   * `"authored"` (unless the host opts into scaffold preview mode).
   * Hosts SHOULD pass this for production learners.
   */
  gradeBand?: string | null;
}

/** Coerce any string into a valid `TutorFunctioningLevel`, defaulting
 *  to `STANDARD` when the value is missing or unrecognised. */
export function normalizeFunctioningLevel(raw: string | null | undefined): TutorFunctioningLevel {
  if (!raw) return "STANDARD";
  const upper = raw.toUpperCase();
  return (FUNCTIONING_LEVELS as readonly string[]).includes(upper)
    ? (upper as TutorFunctioningLevel)
    : "STANDARD";
}

/**
 * Coerce any string into a valid `GradeBand`. Accepts the canonical
 * forms (`K`, `1`-`12`, `PRE_K`, `ADULT`) as well as common variants
 * like `"kindergarten"`, `"pre-k"`, `"prek"`, and plain digits with
 * surrounding whitespace. Returns `undefined` for inputs we can't
 * confidently classify — the runtime gate then no-ops (preserving
 * backward compatibility) rather than throwing an opaque error.
 */
export function normalizeGradeBand(raw: string | null | undefined): GradeBand | undefined {
  if (!raw) return undefined;
  const cleaned = raw
    .trim()
    .toUpperCase()
    .replace(/[-_\s]/g, "_");
  if ((GRADE_BANDS as readonly string[]).includes(cleaned)) return cleaned as GradeBand;
  if (cleaned === "KINDERGARTEN" || cleaned === "PREK") {
    return cleaned === "PREK" ? "PRE_K" : "K";
  }
  const m = cleaned.match(/^(\d{1,2})$/);
  if (m) {
    const n = Number(m[1]);
    if (n >= 1 && n <= 12) return String(n) as GradeBand;
  }
  return undefined;
}

/**
 * Pure builder — take a bag of partially-loaded learner facts and
 * return a runtime-ready `LearnerContext`. The result is always safe
 * to feed into `planSession()`.
 */
export function buildLearnerContext(input: LearnerContextInputs): LearnerContext {
  if (!input.learnerId || typeof input.learnerId !== "string") {
    throw new Error("buildLearnerContext: learnerId is required");
  }
  return {
    learnerId: input.learnerId,
    functioningLevel: normalizeFunctioningLevel(input.functioningLevel),
    masteryRecords: [...(input.masteryRecords ?? [])],
    recentOutcomes: [...(input.recentOutcomes ?? [])],
    recentlyCovered: input.recentlyCovered ? [...input.recentlyCovered] : undefined,
    interestProfile: input.interestProfile,
    gradeBand: normalizeGradeBand(input.gradeBand),
  };
}

/**
 * Down-rank the learner's functioning level to the closest one a tutor
 * actually supports. Tutors that do not support `PRE_SYMBOLIC`, for
 * example, fall back to the most-supportive level they do declare.
 *
 * Returns `null` when the tutor declares no supported levels at all
 * (which the SDK validator would already have rejected). The runtime
 * itself raises `unsupported_functioning_level` for an exact mismatch;
 * callers can use this helper to negotiate a graceful fallback before
 * invoking `planSession()`.
 */
/**
 * Whether this service instance permits planning sessions on
 * non-production (`"scaffold"`) coverageMatrix bands. Production
 * deployments MUST leave this off — the runtime gate refuses unreviewed
 * content. Staging / dev / preview environments opt in via the
 * `AIVO_ALLOW_SCAFFOLD_CONTENT` env var so authors can iterate against
 * AI-draft skill graphs without waiting on SME signoff.
 *
 * Defaults to off; explicit string `"true"` (case-insensitive) enables.
 */
export function isScaffoldAllowedByEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  return String(env.AIVO_ALLOW_SCAFFOLD_CONTENT ?? "").toLowerCase() === "true";
}

export function negotiateFunctioningLevel(
  requested: TutorFunctioningLevel,
  def: TutorDefinition,
): TutorFunctioningLevel | null {
  if (def.functioningLevels.includes(requested)) return requested;
  // Walk down toward the most-supported level the tutor offers.
  const order = FUNCTIONING_LEVELS;
  const idx = order.indexOf(requested);
  for (let i = idx + 1; i < order.length; i += 1) {
    if (def.functioningLevels.includes(order[i])) return order[i];
  }
  for (let i = idx - 1; i >= 0; i -= 1) {
    if (def.functioningLevels.includes(order[i])) return order[i];
  }
  return def.functioningLevels[0] ?? null;
}
