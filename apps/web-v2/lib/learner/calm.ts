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
  | "ask_grown_up";

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
