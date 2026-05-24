/**
 * Content-pack schema (§5 Content infrastructure, v2.1 §9.3 Build).
 *
 * A "content pack" is a sealed, versioned bundle of authored learning
 * activities for a specific (subject, gradeBand) slice — e.g. the
 * "K-Math-Fall-2026" pack. Packs are produced by the (future) admin CMS
 * and consumed by tutor-runtime as bootstrap scaffolding for
 * `planSession()` and as seed material for live LLM generation.
 *
 * AIVO's runtime principle is *generate live, don't pre-author* — packs
 * are not the primary source of activities at session time. They cover
 * cold-start, offline, and budget-capped degraded states, and give the
 * generator high-quality exemplars to imitate.
 *
 * Note: the `FALLBACK_ACTIVITIES` constant in
 * apps/web/src/components/discovery/useDiscoveryEngine.ts is a separate,
 * intentionally minimal client-side safety net for the no-token /
 * ai-svc-unreachable case. It is *not* superseded by this package.
 *
 * Each `Activity` references a `Skill` from `@aivo/skill-graphs` so the
 * pack can be checked for coverage gaps before publish.
 */
import type { GradeBand, Subject } from "@aivo/skill-graphs";
export type { GradeBand, Subject } from "@aivo/skill-graphs";

/** An asset the activity needs at runtime. */
export interface Asset {
  /** Stable id; e.g. "img-apple-01". */
  id: string;
  /**
   * Asset kind. `image`/`audio`/`video` are CDN-hosted blobs; `inline_svg`
   * stores the SVG markup directly inside the pack (used for tiny shapes).
   */
  kind: "image" | "audio" | "video" | "inline_svg" | "captions";
  /** CDN URL for blob assets, or the inline SVG markup for `inline_svg`. */
  src: string;
  /**
   * Required for image/video assets — alt text shown to screen readers and
   * displayed if the asset fails to load. Required for accessibility (WCAG
   * 1.1.1) but optional in the type so we can validate at the validator
   * layer with a clearer error message.
   */
  alt?: string;
  /** Approximate runtime length, ms, for audio/video. */
  durationMs?: number;
  /** SHA-256 of the asset bytes — used by the CMS to detect drift. */
  checksum?: string;
  /** Caption track language (required when kind === "captions"). */
  lang?: string;
  /** Optional learner-visible label for captions track selectors. */
  label?: string;
  /** Default caption track. */
  default?: boolean;
}

/** Activity types map to stage-runtime renderers. Keep in sync with
 * `BeatType` in `@aivo/stage-ui`. */
export type ActivityType =
  | "narration"
  | "multiple_choice"
  | "drag_drop"
  | "voice"
  | "draw"
  | "tap"
  | "match"
  | "video"
  | "audio";

export type DifficultyLevel = "intro" | "core" | "stretch";

/** Adaptations the runtime should apply when rendering this activity. */
export interface AdaptationProfile {
  /** Maximum number of distractors to show on screen at once. */
  maxOnScreenChoices?: number;
  /** Force-on subtitles regardless of the learner's sensory profile. */
  forceSubtitles?: boolean;
  /** Reduce/disable motion (vestibular hypersensitivity). */
  reducedMotion?: boolean;
  /** Additional time allowed (ms) before a "still thinking?" prompt. */
  extraThinkingTimeMs?: number;
  /** Functioning levels this activity is *designed* for. If unset, the
   * activity is considered universal. */
  functioningLevels?: Array<
    "STANDARD" | "SUPPORTED" | "LOW_VERBAL" | "NON_VERBAL" | "PRE_SYMBOLIC"
  >;
}

/** A single learning activity. */
export interface Activity {
  /** Stable id, unique within the pack. */
  id: string;
  /** Display title. */
  title: string;
  /** The skill (from `@aivo/skill-graphs`) this activity assesses /
   * teaches. Use the `Skill.id`. */
  skillId: string;
  type: ActivityType;
  /** Learner-facing prompt or narration. */
  prompt: string;
  /**
   * Choices for `multiple_choice`/`tap`/`match`. The `correct` flag marks
   * the correct answer(s). For `drag_drop`, `value` is the label/zone id.
   */
  choices?: Array<{ id: string; label: string; correct?: boolean; value?: string }>;
  /** For `voice`: expected answer; "|" separates alternative variants. */
  expectedAnswer?: string;
  /** Asset references; ids must resolve to entries in `pack.assets`. */
  assetRefs?: string[];
  difficulty: DifficultyLevel;
  /** Optional explicit adaptation profile. */
  adaptations?: AdaptationProfile;
  /** Free-form tags for content-router experiments / cohort selection. */
  tags?: string[];
}

/** A bundled, signed content pack. */
export interface ContentPack {
  /** Stable id, e.g. "k-math-fall-2026". */
  id: string;
  /** Display title. */
  title: string;
  /** Pack version, semver. Bump on any change to authored content. */
  version: string;
  /** Schema version this pack targets — bump when this file's types
   * change in a backward-incompatible way. */
  schemaVersion: 1;
  subject: Subject;
  gradeBand: GradeBand;
  /** Skill-graph ids whose skills this pack provides activities for. */
  skillGraphRefs: string[];
  /** Author / publisher metadata. */
  publisher: { name: string; email?: string };
  /** Public-domain or license string ("CC-BY-4.0", "Proprietary", ...). */
  license: string;
  /** ISO-8601 publish timestamp. */
  publishedAt: string;
  assets: Asset[];
  activities: Activity[];
  /** Default adaptation profile applied to every activity unless the
   * activity overrides it. */
  defaultAdaptations?: AdaptationProfile;
}

/** Issue codes surfaced by the validator. */
export type ContentPackIssueCode =
  | "missing_required_field"
  | "duplicate_activity_id"
  | "duplicate_asset_id"
  | "unknown_asset_ref"
  | "missing_asset_alt"
  | "no_correct_choice"
  | "multiple_correct_in_single_choice"
  | "voice_missing_expected"
  | "missing_captions_asset"
  | "empty_pack"
  | "unsupported_schema_version";

export interface ContentPackIssue {
  code: ContentPackIssueCode;
  /** Activity / asset id the issue applies to, if any. */
  refId?: string;
  detail: string;
}
