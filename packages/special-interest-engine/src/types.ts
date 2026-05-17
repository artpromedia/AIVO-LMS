/**
 * Special-interest engine (§9.3 Greenfield 4–6w).
 *
 * Tracks each learner's strong-interest catalog (dinosaurs, trains, space,
 * ocean, music, …) and themes authored content with the catalog the
 * learner is most engaged with. The engine is intentionally pure: callers
 * persist `LearnerInterestProfile` records via their existing storage
 * (assessment-svc, brain-svc) and ask this package to score, rank, and
 * apply a theme.
 */

/** Slug of a special interest. New interests can be added at runtime. */
export type InterestSlug = string;

/** A learner's recorded affinity for a specific interest slug. */
export interface LearnerInterestSignal {
  slug: InterestSlug;
  /**
   * Source of the signal — used to weight provenance. Self-report from a
   * caregiver counts more than implicit clickstream.
   */
  source: "caregiver_intake" | "iep_signal" | "engagement" | "self_report" | "system";
  /**
   * Polarity. +1 = strong interest, 0 = neutral, -1 = avoid (sensory or
   * trauma-related). Negative values must short-circuit theming.
   */
  polarity: 1 | 0 | -1;
  /** Confidence 0–1 attached by the source. */
  confidence: number;
  /** ISO-8601 timestamp the signal was recorded. */
  observedAt: string;
}

export interface LearnerInterestProfile {
  learnerId: string;
  signals: LearnerInterestSignal[];
}

/** A theme entry — bundled prompt vocabulary + asset palette. */
export interface InterestTheme {
  slug: InterestSlug;
  /** Display label, e.g. "Dinosaurs". */
  label: string;
  /**
   * Concrete swap-in nouns the templating layer can use. The templating
   * convention is `{{noun}}` / `{{nouns:N}}` in authored prompts.
   */
  nouns: readonly string[];
  /** Verbs that read naturally with the nouns (e.g. "stomp", "roar"). */
  verbs: readonly string[];
  /**
   * Asset namespaces in `@aivo/content-pack` `Asset.id` space. The runtime
   * looks for `${assetNs}/${role}` (e.g. `dinos/character-1`) when picking
   * a substitute for a generic asset.
   */
  assetNamespaces: readonly string[];
  /** Age bands for which this theme is age-appropriate. */
  ageBands: readonly ("PK" | "K-2" | "3-5" | "6-8" | "9-12")[];
  /** Sensory cautions — interests known to overload some learners. */
  sensoryCautions?: readonly ("loud_audio" | "fast_motion" | "flashing")[];
}
