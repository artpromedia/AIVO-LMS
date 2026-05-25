/**
 * @aivo/tutor-runtime — pure-TS runtime that turns a `TutorDefinition`
 * into a deliverable session plan.
 *
 * Inputs:
 *   - `TutorDefinition` (from @aivo/tutor-sdk)
 *   - `LearnerContext` (functioning level, mastery records, recent answers)
 *   - `ContentPack` (from @aivo/content-pack)
 *
 * Output:
 *   - `SessionPlan` — an ordered list of activities adapted to the
 *     learner's functioning level, drawn from skills the pedagogy layer
 *     prioritized.
 *
 * The runtime is intentionally synchronous and side-effect-free: it does
 * NOT call out to LLMs, network, or storage. The host service is
 * responsible for wiring those in.
 */
import type { Activity, ContentPack } from "@aivo/content-pack";
import type { TutorDefinition, TutorFunctioningLevel } from "@aivo/tutor-sdk";
import { assertValidTutorDefinition, getCoverageStatus } from "@aivo/tutor-sdk";
import type { GradeBand } from "@aivo/skill-graphs";
import type { MasteryRecord, AnswerOutcome } from "@aivo/pedagogy";
import { retrieve, scaffold, schedule } from "@aivo/pedagogy";
import { transformActivity } from "@aivo/level-transforms";
import {
  applyTheme,
  pickTheme,
  type InterestTheme,
  type LearnerInterestProfile,
} from "@aivo/special-interest-engine";

export interface LearnerContext {
  learnerId: string;
  functioningLevel: TutorFunctioningLevel;
  masteryRecords: MasteryRecord[];
  recentOutcomes: AnswerOutcome[];
  /** Skills covered earlier today — excluded from retrieval candidates. */
  recentlyCovered?: readonly string[];
  /**
   * Optional learner special-interest profile. When supplied, the
   * runtime themes activities around the highest-scoring safe interest
   * (Minecraft, dinosaurs, trains, …) — special interests are the
   * engine, not a distraction.
   */
  interestProfile?: LearnerInterestProfile;
  /**
   * Optional learner grade band. When supplied, the runtime checks the
   * tutor's `coverageMatrix` and refuses to plan the session if the
   * band is not `"authored"` (unless `opts.allowScaffold` is set).
   * Hosts SHOULD pass this for production learners; previews / authoring
   * tools that need to render scaffold content should omit it or pair
   * it with `allowScaffold: true`.
   */
  gradeBand?: GradeBand;
}

export interface PlanSessionOptions {
  /** Maximum number of activities to plan. Default 8. */
  maxActivities?: number;
  /** Minimum mastery for an activity-skill to be eligible for retrieval. */
  retrievalMinMastery?: number;
  /** Random source — defaults to `Math.random`. */
  rng?: () => number;
  /**
   * Bypass the production-readiness check for the learner's grade band.
   * Use only for authoring / preview surfaces (catalog "try this tutor"
   * panes, content-author tooling). Default false. Production learner
   * sessions must NEVER set this to true.
   */
  allowScaffold?: boolean;
}

export interface SessionPlan {
  tutorId: string;
  learnerId: string;
  functioningLevel: TutorFunctioningLevel;
  /** Ordered activities the runtime should drive next, in delivery order. */
  activities: Activity[];
  /** Per-skill rationale for inclusion (debug / replay). */
  rationale: Array<{ skillId: string; reason: string }>;
}

export class TutorPolicyError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "TutorPolicyError";
  }
}

/** Verify the tutor's policy gates against the host-provided session
 *  preconditions. The host must supply caregiver-consent / age info. */
export interface SessionPreconditions {
  consentRecordId?: string;
  learnerAgeYears?: number;
}

export function checkPolicy(def: TutorDefinition, pre: SessionPreconditions): void {
  if (def.policy.requiresConsent && !pre.consentRecordId) {
    throw new TutorPolicyError(
      "consent_missing",
      `Tutor ${def.id} requires a verified consent record id.`,
    );
  }
  if (
    def.policy.minAgeYears !== undefined &&
    pre.learnerAgeYears !== undefined &&
    pre.learnerAgeYears < def.policy.minAgeYears
  ) {
    throw new TutorPolicyError(
      "below_min_age",
      `Tutor ${def.id} requires age ≥ ${def.policy.minAgeYears}; got ${pre.learnerAgeYears}.`,
    );
  }
  if (!def.functioningLevels.includes("STANDARD")) {
    // Defensive — but harmless. Authors should always include STANDARD.
  }
}

/**
 * Plan a session. The plan walks two sources:
 *   1. Retrieval candidates from the pedagogy layer (mastered-but-decaying
 *      skills). Up to half the slots.
 *   2. New skills with no mastery record yet — drawn from the tutor's
 *      declared skill graphs, in `defaultContentPackRefs` order.
 *
 * Each chosen activity is then transformed for the learner's functioning
 * level via `@aivo/level-transforms`.
 */
export function planSession(
  def: TutorDefinition,
  ctx: LearnerContext,
  pack: ContentPack,
  opts: PlanSessionOptions = {},
): SessionPlan {
  assertValidTutorDefinition(def);
  if (!def.functioningLevels.includes(ctx.functioningLevel)) {
    throw new TutorPolicyError(
      "unsupported_functioning_level",
      `Tutor ${def.id} does not support functioning level "${ctx.functioningLevel}".`,
    );
  }
  if (ctx.gradeBand !== undefined && !opts.allowScaffold) {
    if (!def.gradeBands.includes(ctx.gradeBand)) {
      throw new TutorPolicyError(
        "grade_band_not_in_scope",
        `Tutor ${def.id} does not declare grade band "${ctx.gradeBand}" in its catalog scope.`,
      );
    }
    const status = getCoverageStatus(def, ctx.gradeBand);
    if (status !== undefined && status !== "authored") {
      throw new TutorPolicyError(
        "grade_band_not_production",
        `Tutor ${def.id} grade band "${ctx.gradeBand}" is "${status}" (not "authored"). ` +
          `Production sessions require authored content; pass opts.allowScaffold for previews.`,
      );
    }
  }

  const max = opts.maxActivities ?? 8;
  const rng = opts.rng ?? Math.random;
  const retrievalSlots = Math.floor(max / 2);

  const masteryByLast = ctx.masteryRecords.reduce<Map<string, MasteryRecord>>((acc, m) => {
    acc.set(m.skillId, m);
    return acc;
  }, new Map());

  const retrieval = retrieve({
    catalog: ctx.masteryRecords,
    recentlyCovered: ctx.recentlyCovered ?? [],
    minMastery: opts.retrievalMinMastery,
    topK: retrievalSlots,
  });

  const retrievalSkills = new Set(retrieval.candidates.map((c) => c.skillId));
  const newSkills: string[] = [];
  for (const a of pack.activities) {
    if (retrievalSkills.has(a.skillId)) continue;
    if (masteryByLast.has(a.skillId)) continue;
    if (!newSkills.includes(a.skillId)) newSkills.push(a.skillId);
    if (newSkills.length >= max - retrievalSlots) break;
  }

  const skillsToCover: Array<{ skillId: string; reason: string }> = [];
  for (const r of retrieval.candidates) {
    skillsToCover.push({
      skillId: r.skillId,
      reason: `retrieval-practice (strength=${r.strength.toFixed(3)})`,
    });
  }
  for (const s of newSkills) {
    skillsToCover.push({ skillId: s, reason: "new-skill (no mastery record yet)" });
  }

  // Pick one activity per skill, prefer difficulty matching the scaffold
  // suggestion. We pick deterministically when `rng` is supplied.
  const scaffoldDecision = scaffold({
    recent: ctx.recentOutcomes,
  });

  // Pick a special-interest theme once per session — keeps activity
  // theming consistent and predictable for the learner.
  const theme: InterestTheme | null = ctx.interestProfile ? pickTheme(ctx.interestProfile) : null;

  const activities: Activity[] = [];
  for (const sc of skillsToCover.slice(0, max)) {
    const candidates = pack.activities.filter((a) => a.skillId === sc.skillId);
    if (candidates.length === 0) continue;
    const preferredDifficulty =
      scaffoldDecision.level === "simplify"
        ? "intro"
        : scaffoldDecision.level === "model"
          ? "intro"
          : "core";
    const matches = candidates.filter((a) => a.difficulty === preferredDifficulty);
    const pool = matches.length > 0 ? matches : candidates;
    const pick = pool[Math.floor(rng() * pool.length)];
    const themed = theme ? applyInterestTheme(pick, theme, rng) : pick;
    const transformed = transformActivity(themed, ctx.functioningLevel, {
      defaultAdaptations: pack.defaultAdaptations,
    });
    activities.push(transformed);
  }

  return {
    tutorId: def.id,
    learnerId: ctx.learnerId,
    functioningLevel: ctx.functioningLevel,
    activities,
    rationale: skillsToCover.slice(0, activities.length),
  };
}

export type { Activity, ContentPack } from "@aivo/content-pack";
export type { TutorDefinition, TutorFunctioningLevel } from "@aivo/tutor-sdk";
export { schedule, scaffold, retrieve } from "@aivo/pedagogy";

/**
 * Apply a learner-interest theme to an activity — re-themes title +
 * prompt + textual choices via the engine's `{{noun}}` / `{{verb}}`
 * placeholders. Activities without placeholders are returned unchanged
 * (no garbling of unauthored content). The themed activity preserves
 * the original id, skillId, difficulty, and choice ids; only display
 * strings are rewritten so analytics keep working.
 */
function applyInterestTheme(activity: Activity, theme: InterestTheme, rng: () => number): Activity {
  const themePlaceholderRe = /\{\{(?:noun|verb)\}\}/;
  const titleHas = themePlaceholderRe.test(activity.title);
  const promptHas = themePlaceholderRe.test(activity.prompt);
  const choicesHas = activity.choices?.some((c) => themePlaceholderRe.test(c.label));
  if (!titleHas && !promptHas && !choicesHas) return activity;
  return {
    ...activity,
    title: titleHas ? applyTheme(activity.title, theme, rng) : activity.title,
    prompt: promptHas ? applyTheme(activity.prompt, theme, rng) : activity.prompt,
    choices: activity.choices?.map((c) => ({
      ...c,
      label: themePlaceholderRe.test(c.label) ? applyTheme(c.label, theme, rng) : c.label,
    })),
    tags: [...(activity.tags ?? []), `themed:${theme.slug}`],
  };
}

/**
 * Convenience — apply an answer outcome to the learner's mastery record
 * for a skill, producing the new record. Wraps `pedagogy.schedule`.
 */
export function applyOutcome(
  current: MasteryRecord,
  outcome: AnswerOutcome,
  now?: string,
): MasteryRecord {
  return schedule({ current, outcome, now }).next;
}
