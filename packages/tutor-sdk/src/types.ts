/**
 * @aivo/tutor-sdk — public SDK for declaring AIVO tutors.
 *
 * A `TutorDefinition` is a portable description of a tutor — its persona,
 * the capabilities it offers (chat, voice, AAC), the skill graphs it can
 * cover, and the policy gates that must pass before a session can start.
 * Definitions are loaded by `@aivo/tutor-runtime` at session-start time
 * and are the contract between authoring teams and the runtime.
 *
 * Definitions are intentionally serializable JSON-shape values (no closures,
 * no class instances) so they can be stored in postgres, signed for
 * tamper-evidence, and shipped to mobile clients for offline use.
 */
import type { GradeBand, Subject } from "@aivo/skill-graphs";

/** Personality styling for a tutor's narration. */
export interface TutorPersona {
  /** Stable id, e.g. `"speech-buddy"`, `"math-coach"`. */
  id: string;
  /** Display name. */
  name: string;
  /** One-line description. */
  tagline: string;
  /** Speaking style — picked up by the TTS layer to choose a voice. */
  voiceStyle: "warm" | "calm" | "playful" | "neutral";
  /** Locale code, e.g. `"en-US"`. */
  locale: string;
}

/** Capability flag a tutor declares it can use. */
export type TutorCapability =
  | "chat"
  | "voice_in"
  | "voice_out"
  | "image_in"
  | "image_out"
  | "aac_input"
  | "switch_scan"
  | "eye_gaze"
  | "draw"
  | "manipulatives"
  | "code_run";

/** Functioning levels supported by a tutor. */
export type TutorFunctioningLevel =
  | "STANDARD"
  | "SUPPORTED"
  | "LOW_VERBAL"
  | "NON_VERBAL"
  | "PRE_SYMBOLIC";

/** Policy gate — runtime must pass these before starting a session. */
export interface TutorPolicyGates {
  /** Family/caregiver consent record id is required (e.g. for voice in). */
  requiresConsent: boolean;
  /** Minimum age (years). Caller is responsible for verifying age. */
  minAgeYears?: number;
  /** Maximum session length, minutes. Runtime hard-stops at this limit. */
  maxSessionMinutes?: number;
  /** PII-scrubbing must run on every learner utterance. Default true. */
  requirePiiScrubbing?: boolean;
}

/** A tutor definition — the SDK contract between authors and the runtime. */
export interface TutorDefinition {
  /** Stable id, e.g. `"speech-buddy@1.0.0"`. Must include semver tail. */
  id: string;
  /** Schema version — bump when this file's types change. */
  schemaVersion: 1;
  persona: TutorPersona;
  capabilities: readonly TutorCapability[];
  /** Subjects this tutor teaches. */
  subjects: readonly Subject[];
  /** Grade bands this tutor supports. */
  gradeBands: readonly GradeBand[];
  /** Functioning levels this tutor supports out of the box. */
  functioningLevels: readonly TutorFunctioningLevel[];
  /** Skill-graph ids this tutor knows how to cover. */
  skillGraphRefs: readonly string[];
  /** Default content-pack ids the tutor pulls activities from. */
  defaultContentPackRefs: readonly string[];
  /** Policy gates — checked at session start. */
  policy: TutorPolicyGates;
  /**
   * Free-form metadata for the authoring team. The runtime ignores this
   * field; the admin CMS surfaces it in the tutor catalog.
   */
  authoringMeta?: Record<string, string>;
}

/** Issue codes surfaced by `validateTutorDefinition`. */
export type TutorDefinitionIssueCode =
  | "missing_required_field"
  | "invalid_id"
  | "unsupported_schema_version"
  | "empty_subjects"
  | "empty_grade_bands"
  | "empty_functioning_levels"
  | "empty_skill_graph_refs"
  | "policy_consent_required_for_voice"
  | "duplicate_capability";

export interface TutorDefinitionIssue {
  code: TutorDefinitionIssueCode;
  detail: string;
  /** Path into the definition where the issue was found. */
  path?: string;
}
