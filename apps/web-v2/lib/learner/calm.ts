/**
 * Calm Corner — pure activity catalog + selectors.
 *
 * No I/O, no server imports: every export is a deterministic, total
 * function so the BFF route and the client component stay thin and the
 * unit tests are exhaustive. The activity ids intentionally mirror the
 * SelfRegulationPrompt union in
 * services/homework-svc/src/services/self-regulation-recommender.ts so a
 * homework focus signal can deep-link straight into the right activity.
 */

export type CalmActivityId =
  | "box_breathing"
  | "five_senses_grounding"
  | "stretch_break"
  | "smaller_step"
  | "switch_to_drawing"
  | "listen_again"
  | "ask_grown_up"
  | "pattern_focus"
  | "sorting_calm";

export type CalmActivityKind =
  | "breathing"
  | "grounding"
  | "movement"
  | "strategy"
  | "support";

export interface CalmActivity {
  id: CalmActivityId;
  kind: CalmActivityKind;
  /** Suggested duration for the guided timer (seconds). 0 = no timer. */
  durationSeconds: number;
  /** False when the activity has motion that should be reduced under
   *  prefers-reduced-motion (only the breathing orb today). */
  motionSafe: boolean;
  /** i18n key suffixes resolved under the `learner.calm.activities` namespace. */
  titleKey: string;
  bodyKey: string;
}

/** Ordered so the calmest, most universal options come first. */
const CALM_CATALOG: readonly CalmActivity[] = [
  {
    id: "box_breathing",
    kind: "breathing",
    durationSeconds: 64, // 4 rounds of a 4-4-4-4 box (16s/round)
    motionSafe: false,
    titleKey: "box_breathing_title",
    bodyKey: "box_breathing_body",
  },
  {
    id: "five_senses_grounding",
    kind: "grounding",
    durationSeconds: 0,
    motionSafe: true,
    titleKey: "five_senses_title",
    bodyKey: "five_senses_body",
  },
  {
    id: "stretch_break",
    kind: "movement",
    durationSeconds: 30,
    motionSafe: true,
    titleKey: "stretch_title",
    bodyKey: "stretch_body",
  },
  {
    id: "smaller_step",
    kind: "strategy",
    durationSeconds: 0,
    motionSafe: true,
    titleKey: "smaller_step_title",
    bodyKey: "smaller_step_body",
  },
  {
    id: "switch_to_drawing",
    kind: "strategy",
    durationSeconds: 0,
    motionSafe: true,
    titleKey: "switch_drawing_title",
    bodyKey: "switch_drawing_body",
  },
  {
    id: "listen_again",
    kind: "strategy",
    durationSeconds: 0,
    motionSafe: true,
    titleKey: "listen_again_title",
    bodyKey: "listen_again_body",
  },
  {
    id: "ask_grown_up",
    kind: "support",
    durationSeconds: 0,
    motionSafe: true,
    titleKey: "ask_grown_up_title",
    bodyKey: "ask_grown_up_body",
  },
  {
    id: "pattern_focus",
    kind: "grounding",
    durationSeconds: 0,
    motionSafe: true,
    titleKey: "pattern_focus_title",
    bodyKey: "pattern_focus_body",
  },
  {
    id: "sorting_calm",
    kind: "grounding",
    durationSeconds: 0,
    motionSafe: true,
    titleKey: "sorting_calm_title",
    bodyKey: "sorting_calm_body",
  },
] as const;

const CALM_IDS: ReadonlySet<string> = new Set(CALM_CATALOG.map((a) => a.id));

/** The full, ordered catalog. */
export function getCalmCatalog(): readonly CalmActivity[] {
  return CALM_CATALOG;
}

export function isCalmActivityId(value: unknown): value is CalmActivityId {
  return typeof value === "string" && CALM_IDS.has(value);
}

export function getCalmActivity(id: CalmActivityId): CalmActivity {
  // Safe: id is constrained by isCalmActivityId at the call sites.
  return CALM_CATALOG.find((a) => a.id === id) as CalmActivity;
}

/**
 * Homework focus actions (FocusAction in homework-svc) → Calm activity.
 * Kept total: any unrecognized action falls back to box breathing, the
 * safest universal option.
 */
export type FocusActionLike =
  | "micro_hint"
  | "simplify_step"
  | "offer_break"
  | "switch_surface"
  | "parent_support"
  | (string & {});

export function recommendCalmActivity(
  action: FocusActionLike | null | undefined,
): CalmActivityId {
  switch (action) {
    case "simplify_step":
      return "smaller_step";
    case "switch_surface":
      return "switch_to_drawing";
    case "parent_support":
      return "ask_grown_up";
    case "micro_hint":
      return "listen_again";
    case "offer_break":
    default:
      return "box_breathing";
  }
}

/** Affirmation shown after a completed activity. Resolved under
 *  `learner.calm.affirmations`. Total over the activity union. */
export function affirmationKeyFor(id: CalmActivityId): string {
  switch (id) {
    case "box_breathing":
    case "five_senses_grounding":
      return "calmer";
    case "stretch_break":
      return "refreshed";
    case "smaller_step":
    case "switch_to_drawing":
    case "listen_again":
    case "pattern_focus":
    case "sorting_calm":
      return "ready";
    case "ask_grown_up":
      return "supported";
  }
}

/** Box-breathing phase plan, derived deterministically from a round count.
 *  Exported so both the UI and tests share one source of truth. */
export type BreathPhase = "inhale" | "hold_in" | "exhale" | "hold_out";

export const BOX_BREATH_PHASE_SECONDS = 4;
export const BOX_BREATH_PHASES: readonly BreathPhase[] = [
  "inhale",
  "hold_in",
  "exhale",
  "hold_out",
];

export function boxBreathRounds(): number {
  return (
    getCalmActivity("box_breathing").durationSeconds /
    (BOX_BREATH_PHASES.length * BOX_BREATH_PHASE_SECONDS)
  );
}

/* ===== Calming mini-games — pure logic =====
 * Kept here (no I/O, no React) so the UI stays thin and the rules are
 * exhaustively unit-testable. Randomness is injected via `rng` for
 * deterministic tests; callers default to `Math.random` at the call site.
 * These are calm focus activities: no scoring, no timers, no "lose" state.
 */

/** Number of distinct tiles in the Pattern Focus board. */
export const PATTERN_TILE_COUNT = 4;

/** Default round length for Pattern Focus — short and low-stakes. */
export const PATTERN_DEFAULT_LENGTH = 4;

/**
 * A calm "watch then repeat" sequence of tile indices in
 * [0, PATTERN_TILE_COUNT). Deterministic for a given `rng`.
 */
export function generatePatternSequence(rng: () => number, length: number): number[] {
  const safeLength = Math.max(0, Math.floor(length));
  const out: number[] = [];
  for (let i = 0; i < safeLength; i += 1) {
    out.push(Math.floor(rng() * PATTERN_TILE_COUNT));
  }
  return out;
}

/** True only when the guess matches the sequence exactly (order + values). */
export function isPatternGuessCorrect(sequence: number[], guess: number[]): boolean {
  if (sequence.length !== guess.length) return false;
  return sequence.every((tile, i) => tile === guess[i]);
}

/** One item in the Sorting Calm tray — a value the learner arranges low→high. */
export interface SortItem {
  id: string;
  /** The sort key (1..count) the learner arranges into ascending order. */
  value: number;
}

/** Default number of items in a Sorting Calm tray. */
export const SORTING_DEFAULT_COUNT = 5;

/**
 * Items with values 1..count in a shuffled order (Fisher–Yates driven by
 * `rng`, so it is deterministic for tests). Ids are stable per value so the
 * UI can key on them across reorders.
 */
export function generateSortingItems(rng: () => number, count: number): SortItem[] {
  const safeCount = Math.max(0, Math.floor(count));
  const items: SortItem[] = [];
  for (let v = 1; v <= safeCount; v += 1) {
    items.push({ id: `sort_${v}`, value: v });
  }
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = items[i];
    items[i] = items[j];
    items[j] = tmp;
  }
  return items;
}

/** True when items are in non-decreasing order by value (the solved tray). */
export function isSortingSolved(items: readonly SortItem[]): boolean {
  for (let i = 1; i < items.length; i += 1) {
    if (items[i - 1].value > items[i].value) return false;
  }
  return true;
}
