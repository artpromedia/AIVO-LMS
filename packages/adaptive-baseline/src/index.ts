/**
 * @aivo/adaptive-baseline
 *
 * A traditional 20-question fixed-form baseline disadvantages kids with
 * reading difficulties, slow processing speed, or test anxiety. This
 * package implements a real-time adaptive baseline that:
 *
 *   1. Adjusts item difficulty after every answer using a 1-PL Elo-style
 *      θ update (no MML, no JIT compilation — pure arithmetic).
 *   2. Stops early once the standard error of θ falls below a threshold,
 *      so a learner never sits through 20 items they cannot answer.
 *   3. Treats every item as multimodal: each item declares the modalities
 *      it is delivered through (visual / auditory / kinesthetic /
 *      reading), with a light-reading flag for items that are reading-
 *      free or near-reading-free.
 *   4. Emits a `LearningProfile` alongside the grade-level placement —
 *      modality fit, attention pattern, frustration tolerance, processing
 *      speed. The profile is the primary output; grade level is one
 *      derived signal, not the goal.
 *
 * The runtime is pure / synchronous / deterministic (when seeded) so the
 * host service can wrap it in any transport (HTTP/WS) and replay sessions
 * for QA.
 */

export type Modality = "visual" | "auditory" | "kinesthetic" | "reading";

export type AffectSignal = "frustration" | "disengagement" | "delight" | "calm";

export interface BaselineItem {
  id: string;
  /** Skill (or sub-skill) measured. */
  skillId: string;
  /**
   * Item difficulty on the same logit scale as learner θ. Items at θ=0
   * are 50/50 for an average learner; +1 ≈ 73% incorrect; -1 ≈ 73%
   * correct.
   */
  difficulty: number;
  /** Modalities this item is *delivered* through. */
  modalities: readonly Modality[];
  /**
   * True when the item carries little-to-no required reading load
   * (icon-only choice, audio prompt, etc.). Used to up-weight selection
   * for learners flagged with reading difficulty.
   */
  lightReading: boolean;
  /** Optional grade-band hint; the placement step uses this. */
  gradeBand?: string;
  /**
   * IRT 2-PL discrimination (`a`) — how sharply the item separates
   * learners around its difficulty. Higher `a` ⇒ a steeper response curve
   * and more Fisher information near θ=b. Optional: when omitted it
   * defaults to 1, which makes the 2-PL math collapse to the original
   * 1-PL behaviour, so 1-PL banks are unaffected.
   */
  discrimination?: number;
  /**
   * Subject this item assesses (Wave C, G1 — per-subject placement).
   * Free-form here; finalize groups responses by this value and callers
   * canonicalise the keys (`@aivo/scoring` `canonicalSubjectKey`).
   * Optional: items without a subject contribute to the overall θ only.
   */
  subjectId?: string;
}

/** 2-PL discrimination default — `a=1` reduces every formula to 1-PL. */
export const DEFAULT_DISCRIMINATION = 1;

/** P(correct | θ, item) under the 2-PL model: sigmoid(a·(θ − b)). */
export function itemProbability(theta: number, item: BaselineItem): number {
  const a = item.discrimination ?? DEFAULT_DISCRIMINATION;
  return 1 / (1 + Math.exp(-a * (theta - item.difficulty)));
}

/** Fisher information the item carries about θ: a²·p·(1−p). */
export function itemInformation(theta: number, item: BaselineItem): number {
  const a = item.discrimination ?? DEFAULT_DISCRIMINATION;
  const p = itemProbability(theta, item);
  return a * a * p * (1 - p);
}

export interface ItemResponse {
  itemId: string;
  /** True if the response was scored correct. */
  correct: boolean;
  /** Time the learner spent before answering, ms. */
  responseTimeMs: number;
  /** Optional in-band affect signals captured by the client. */
  affect?: readonly AffectSignal[];
  /** Modality the learner actually consumed (chosen by client). */
  consumedModality?: Modality;
}

export interface BaselineState {
  /** Learner ability estimate on the logit scale. Init at 0. */
  theta: number;
  /**
   * Posterior precision (Fisher info accumulator). Higher = more
   * confident. SE(θ) ≈ 1/sqrt(infoSum).
   */
  infoSum: number;
  /** Items already administered, in order. */
  administered: ItemResponse[];
  /** Skills already covered, lower-cased ids. */
  coveredSkills: Set<string>;
  /**
   * Reading-difficulty hint from intake. When true the selector prefers
   * `lightReading` items at the same difficulty.
   */
  readingDifficulty: boolean;
}

/** Standard learning rate / discrimination for the 1-PL update. */
const K = 0.4;

/** SE(θ) target at which the assessment should stop. */
const SE_STOP = 0.35;

/** Hard caps so the assessment never runs forever and never ends too fast. */
const MIN_ITEMS = 6;
const MAX_ITEMS = 20;

export interface InitBaselineOptions {
  readingDifficulty?: boolean;
  /** Optional initial θ from a prior baseline / parent intake. */
  priorTheta?: number;
}

export function initBaseline(opts: InitBaselineOptions = {}): BaselineState {
  return {
    theta: opts.priorTheta ?? 0,
    infoSum: 0,
    administered: [],
    coveredSkills: new Set(),
    readingDifficulty: opts.readingDifficulty ?? false,
  };
}

/**
 * Pick the next item. The selector minimises the difficulty gap to θ,
 * skips already-administered items, prefers uncovered skills, and (when
 * `state.readingDifficulty` is set) prefers `lightReading` candidates
 * within a 0.5-logit tie band.
 *
 * Returns `null` when the bank is exhausted.
 */
// --- Kindness guardrail (G5) --------------------------------------------
// Base ceiling: never serve an item harder than θ + this, tightening as
// recent struggle mounts. Overshooting a struggling learner is what
// triggers frustration / shutdown.
export const FRUSTRATION_CEILING = 1.0;
const CEILING_MILD = 0.5;
const CEILING_HIGH = 0.25;
const STREAK_MILD = 2;
const STREAK_HIGH = 3;

export type FrustrationLevel = "none" | "mild" | "high";

export interface FrustrationRead {
  level: FrustrationLevel;
  /** Logits above θ that selection should not exceed at this level. */
  ceiling: number;
  /** Trailing run of incorrect / affect-flagged answers. */
  struggleStreak: number;
}

/**
 * Read recent struggle from the administered responses: a trailing run of
 * incorrect answers and/or in-band frustration/disengagement affect
 * signals. Unlike the web client (which also sees skips + latency), the
 * engine works from what it records — correctness + affect.
 */
export function assessFrustration(state: BaselineState): FrustrationRead {
  let streak = 0;
  for (let i = state.administered.length - 1; i >= 0; i--) {
    const r = state.administered[i]!;
    const affectStruggle =
      r.affect?.some((a) => a === "frustration" || a === "disengagement") ?? false;
    if (!r.correct || affectStruggle) streak += 1;
    else break;
  }
  const level: FrustrationLevel =
    streak >= STREAK_HIGH ? "high" : streak >= STREAK_MILD ? "mild" : "none";
  const ceiling =
    level === "high" ? CEILING_HIGH : level === "mild" ? CEILING_MILD : FRUSTRATION_CEILING;
  return { level, ceiling, struggleStreak: streak };
}

/**
 * Selection cost (lower = preferred): distance of the item difficulty from
 * θ, minus a discrimination preference (a more discriminating item carries
 * more Fisher information near θ), plus the covered-skill and
 * reading-difficulty nudges. The discrimination term is 0 when a=1, so
 * 1-PL banks select exactly as before.
 */
const DISCRIMINATION_PREF = 0.3;

function bestByScore(state: BaselineState, candidates: BaselineItem[]): BaselineItem {
  const score = (it: BaselineItem) => {
    const gap = Math.abs(it.difficulty - state.theta);
    let s = gap;
    s -= DISCRIMINATION_PREF * ((it.discrimination ?? DEFAULT_DISCRIMINATION) - 1);
    if (state.coveredSkills.has(it.skillId.toLowerCase())) s += 0.25;
    if (state.readingDifficulty && !it.lightReading) s += 0.5;
    return s;
  };
  let best = candidates[0]!;
  let bestScore = score(best);
  for (let i = 1; i < candidates.length; i++) {
    const s = score(candidates[i]!);
    if (s < bestScore) {
      best = candidates[i]!;
      bestScore = s;
    }
  }
  return best;
}

export interface PickOptions {
  /**
   * When true, cap the hardest item at θ + the frustration ceiling. If the
   * whole remaining pool is above the cap, serve the *easiest* item
   * (undershoot) rather than the nearest. Opt-in so existing callers keep
   * the pure nearest-θ behaviour.
   */
  applyFrustrationCeiling?: boolean;
}

export function pickNextItem(
  state: BaselineState,
  bank: readonly BaselineItem[],
  opts: PickOptions = {},
): BaselineItem | null {
  const seen = new Set(state.administered.map((r) => r.itemId));
  const candidates = bank.filter((it) => !seen.has(it.id));
  if (candidates.length === 0) return null;

  if (opts.applyFrustrationCeiling) {
    const cap = state.theta + assessFrustration(state).ceiling;
    const within = candidates.filter((it) => it.difficulty <= cap);
    if (within.length === 0) {
      // Everything left is above the kindness ceiling — undershoot.
      return candidates.reduce((easiest, it) =>
        it.difficulty < easiest.difficulty ? it : easiest,
      );
    }
    return bestByScore(state, within);
  }

  return bestByScore(state, candidates);
}

export interface RecordResponseInput {
  state: BaselineState;
  item: BaselineItem;
  response: ItemResponse;
}

/**
 * Apply a 1-PL Elo-style update to θ:
 *   p = sigmoid(θ - b)
 *   θ ← θ + K · (correct - p)
 *   info ← info + p·(1-p)
 *
 * Returns a *new* state — the input is not mutated.
 */
export function recordResponse(input: RecordResponseInput): BaselineState {
  const { state, item, response } = input;
  if (response.itemId !== item.id) {
    throw new Error(
      `recordResponse: itemId mismatch (response=${response.itemId} item=${item.id})`,
    );
  }
  const a = item.discrimination ?? DEFAULT_DISCRIMINATION;
  const p = itemProbability(state.theta, item);
  const correct = response.correct ? 1 : 0;
  // 2-PL stochastic-gradient θ update: the log-likelihood gradient wrt θ
  // is a·(correct − p), so a high-discrimination answer moves θ more.
  const nextTheta = state.theta + K * a * (correct - p);
  // 2-PL Fisher information: a²·p·(1−p).
  const info = a * a * p * (1 - p);
  const nextCovered = new Set(state.coveredSkills);
  nextCovered.add(item.skillId.toLowerCase());
  return {
    theta: nextTheta,
    infoSum: state.infoSum + info,
    administered: [...state.administered, response],
    coveredSkills: nextCovered,
    readingDifficulty: state.readingDifficulty,
  };
}

export interface StopDecision {
  stop: boolean;
  reason: "max_items" | "se_below_threshold" | "min_items_pending" | "in_progress";
  se: number;
}

/**
 * Stop when either:
 *   - we've administered ≥ MIN_ITEMS AND SE(θ) ≤ 0.35, or
 *   - we've administered MAX_ITEMS regardless.
 */
export function shouldStop(state: BaselineState): StopDecision {
  const n = state.administered.length;
  const se = state.infoSum > 0 ? 1 / Math.sqrt(state.infoSum) : Infinity;
  if (n >= MAX_ITEMS) return { stop: true, reason: "max_items", se };
  if (n < MIN_ITEMS) return { stop: false, reason: "min_items_pending", se };
  if (se <= SE_STOP) return { stop: true, reason: "se_below_threshold", se };
  return { stop: false, reason: "in_progress", se };
}

export interface ModalityFit {
  modality: Modality;
  /** Accuracy when the learner consumed the item via this modality. */
  accuracy: number;
  /** Number of items observed for this modality (≥1 for the entry to appear). */
  n: number;
}

export interface LearningProfile {
  /**
   * Modality fit ordered best→worst by accuracy (ties broken by larger
   * n, then by canonical modality order).
   */
  modalityFit: ModalityFit[];
  /**
   * Median time-to-respond on correct items, ms. Robust estimator —
   * unaffected by the long-tail bail-outs typical of slow-processing
   * learners.
   */
  processingSpeedMs: number;
  /**
   * 0…1 fraction of items where any frustration / disengagement signal
   * fired. Lower is better. Useful threshold for "needs break".
   */
  frustrationRate: number;
  /**
   * Streak length before the first frustration / disengagement signal
   * appeared. A higher number means the learner sustained attention
   * longer before fatigue. ≥ administered.length means no signal fired.
   */
  attentionRunLength: number;
  /**
   * Final θ → grade-level placement (rough — host can override). Rounded
   * to 1 decimal so downstream UI is stable across small score jitters.
   */
  thetaPlacement: number;
  /**
   * One of "low" / "moderate" / "high" — derived from frustrationRate
   * (≥0.4 → low, ≥0.15 → moderate, else high). This is the column the
   * parent dashboard surfaces to gate session length.
   */
  frustrationTolerance: "low" | "moderate" | "high";
}

/** Canonical modality order for stable tie-breaking. */
const MODALITY_ORDER: Modality[] = ["visual", "auditory", "kinesthetic", "reading"];

/** Build the learning profile from the administered responses. */
export function buildLearningProfile(
  state: BaselineState,
  bank: readonly BaselineItem[],
): LearningProfile {
  const itemById = new Map(bank.map((it) => [it.id, it]));

  // ---- modality fit -----------------------------------------------------
  const buckets = new Map<Modality, { correct: number; n: number }>();
  for (const r of state.administered) {
    const it = itemById.get(r.itemId);
    if (!it) continue;
    // Default to all delivered modalities if the client did not supply
    // `consumedModality`; this still credits the learner against each
    // available modality, which is the conservative read.
    const mods: readonly Modality[] = r.consumedModality ? [r.consumedModality] : it.modalities;
    for (const m of mods) {
      const cur = buckets.get(m) ?? { correct: 0, n: 0 };
      cur.n += 1;
      if (r.correct) cur.correct += 1;
      buckets.set(m, cur);
    }
  }
  const modalityFit: ModalityFit[] = [...buckets.entries()].map(([modality, b]) => ({
    modality,
    accuracy: b.n === 0 ? 0 : b.correct / b.n,
    n: b.n,
  }));
  modalityFit.sort((a, b) => {
    if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
    if (b.n !== a.n) return b.n - a.n;
    return MODALITY_ORDER.indexOf(a.modality) - MODALITY_ORDER.indexOf(b.modality);
  });

  // ---- processing speed (median over correct items) ---------------------
  const correctTimes = state.administered
    .filter((r) => r.correct)
    .map((r) => r.responseTimeMs)
    .sort((a, b) => a - b);
  const processingSpeedMs =
    correctTimes.length === 0
      ? 0
      : correctTimes.length % 2 === 1
        ? correctTimes[(correctTimes.length - 1) / 2]
        : Math.round(
            (correctTimes[correctTimes.length / 2 - 1] + correctTimes[correctTimes.length / 2]) / 2,
          );

  // ---- frustration rate + run-length ------------------------------------
  let frustrationCount = 0;
  let attentionRunLength = state.administered.length;
  for (let i = 0; i < state.administered.length; i++) {
    const r = state.administered[i];
    const fired = r.affect?.some((a) => a === "frustration" || a === "disengagement");
    if (fired) {
      frustrationCount += 1;
      if (attentionRunLength === state.administered.length) {
        attentionRunLength = i;
      }
    }
  }
  const frustrationRate =
    state.administered.length === 0 ? 0 : frustrationCount / state.administered.length;

  const frustrationTolerance: LearningProfile["frustrationTolerance"] =
    frustrationRate >= 0.4 ? "low" : frustrationRate >= 0.15 ? "moderate" : "high";

  return {
    modalityFit,
    processingSpeedMs,
    frustrationRate,
    attentionRunLength,
    thetaPlacement: Math.round(state.theta * 10) / 10,
    frustrationTolerance,
  };
}

/** Final result returned to the host — placement + profile. */
export interface BaselineResult {
  finalTheta: number;
  itemsAdministered: number;
  profile: LearningProfile;
}

/** Convenience: end the assessment and produce the final result. */
export function finalize(state: BaselineState, bank: readonly BaselineItem[]): BaselineResult {
  return {
    finalTheta: state.theta,
    itemsAdministered: state.administered.length,
    profile: buildLearningProfile(state, bank),
  };
}

/** Minimum responses a subject needs before its own θ is trustworthy. */
export const SUBJECT_THETA_MIN_ITEMS = 4;

/**
 * Per-subject ability estimates (Wave C, G1).
 *
 * Replays the administered responses grouped by the bank items'
 * `subjectId`, running the SAME sequential 2-PL update the live run uses
 * (θ₀ = 0, K = 0.4), so a subject's θ is exactly what the engine would
 * have estimated had it run that subject alone. Subjects with fewer than
 * `minItems` responses are omitted — too little signal to place a
 * neurodiverse learner on, and the caller falls back to the overall θ.
 * Returned values are rounded to 0.1 like `thetaPlacement`.
 */
export function estimateSubjectThetas(
  state: BaselineState,
  bank: readonly BaselineItem[],
  opts: { minItems?: number } = {},
): Record<string, number> {
  const minItems = opts.minItems ?? SUBJECT_THETA_MIN_ITEMS;
  const itemById = new Map(bank.map((it) => [it.id, it]));
  const perSubject = new Map<string, { theta: number; n: number }>();
  for (const response of state.administered) {
    const item = itemById.get(response.itemId);
    const subject = item?.subjectId;
    if (!item || !subject) continue;
    const cur = perSubject.get(subject) ?? { theta: 0, n: 0 };
    const a = item.discrimination ?? DEFAULT_DISCRIMINATION;
    const p = 1 / (1 + Math.exp(-a * (cur.theta - item.difficulty)));
    cur.theta = cur.theta + K * a * ((response.correct ? 1 : 0) - p);
    cur.n += 1;
    perSubject.set(subject, cur);
  }
  const out: Record<string, number> = {};
  for (const [subject, { theta, n }] of perSubject) {
    if (n < minItems) continue;
    out[subject] = Math.round(theta * 10) / 10;
  }
  return out;
}
