/**
 * Harmony — Social-Emotional Learning tutor (`@aivo/tutor-sdk`
 * `TutorDefinition`).
 *
 * SEL content can surface trauma-adjacent material; family consent is
 * required and PII scrubbing is mandatory. Persona / subject-strategy:
 * `ADDON_TUTOR_SEL`.
 */
import {
  defineTutor,
  NO_MEMORY,
  standardActionPolicy,
  type TutorDefinition,
} from "@aivo/tutor-sdk";

export const selTutor: TutorDefinition = defineTutor({
  id: "harmony@1.0.0",
  schemaVersion: 1,
  persona: {
    id: "harmony",
    name: "Harmony",
    tagline: "All feelings are welcome here.",
    voiceStyle: "calm",
    locale: "en-US",
  },
  capabilities: ["chat", "agentic_guidance", "voice_out", "image_in", "draw"],
  subjects: ["sel"],
  gradeBands: ["PRE_K", "K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"],
  functioningLevels: ["STANDARD", "SUPPORTED", "LOW_VERBAL", "NON_VERBAL", "PRE_SYMBOLIC"],
  skillGraphRefs: ["prek-sel-foundations", "casel-sel-k2", "casel-sel-3-12"],
  defaultContentPackRefs: ["sel-k-fall-2026"],
  // Honest coverage (remediation Sprint 01): a band is "authored" only when
  // ≥3 real production items back it AND a signed, non-draft skill graph
  // covers it — machine-checked by `pnpm curriculum:coverage`.
  // The CASEL-aligned SEL item bank clears that bar at 3, 5, and 8 only;
  // every other band is honestly "scaffold" until authored
  // (docs/quality/tutor-k12-coverage-gap-plan.md).
  coverageMatrix: {
    PRE_K: "scaffold",
    K: "scaffold",
    "1": "scaffold",
    "2": "scaffold",
    "3": "authored",
    "4": "scaffold",
    "5": "authored",
    "6": "scaffold",
    "7": "scaffold",
    "8": "authored",
    "9": "scaffold",
    "10": "scaffold",
    "11": "scaffold",
    "12": "scaffold",
  },
  // Wave E (S8): agent loop instruments + per-level action policy.
  toolset: ["get_learner_snapshot", "get_skill_position", "get_curriculum_context", "file_evidence", "propose_recommendation"],
  actionPolicy: standardActionPolicy({
    SUPPORTED: [
      "advance",
      "remediate",
      "switch_modality",
      "insert_scaffold",
      "offer_break",
      "end_early",
      "present_surface",
    ],
  }),
  memoryPolicy: NO_MEMORY,
  policy: {
    requiresConsent: true,
    minAgeYears: 4,
    maxSessionMinutes: 15,
    requirePiiScrubbing: true,
  },
  authoringMeta: {
    owner: "curriculum-sel",
    status: "production",
    aiSvcPersonaKey: "ADDON_TUTOR_SEL",
  },
});

export const SEL_TUTOR_MODE_ID = "sel_tutor" as const;
