/**
 * Atlas — Geography & World Cultures tutor (`@aivo/tutor-sdk`
 * `TutorDefinition`).
 *
 * Atlas frames lessons as expeditions across continents. Persona /
 * subject-strategy: `ADDON_TUTOR_SOCIAL_STUDIES` (the persona file
 * keeps Atlas under the social-studies bucket; the runtime classifies
 * the subject as `geography` for skill-graph routing).
 */
import {
  defineTutor,
  NO_MEMORY,
  standardActionPolicy,
  type TutorDefinition,
} from "@aivo/tutor-sdk";

export const geographyTutor: TutorDefinition = defineTutor({
  id: "atlas@1.0.0",
  schemaVersion: 1,
  persona: {
    id: "atlas",
    name: "Atlas",
    tagline: "Today we travel together.",
    voiceStyle: "warm",
    locale: "en-US",
  },
  capabilities: ["chat", "agentic_guidance", "voice_out", "image_in", "image_out", "draw"],
  subjects: ["geography"],
  gradeBands: ["PRE_K", "K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"],
  functioningLevels: ["STANDARD", "SUPPORTED", "LOW_VERBAL", "NON_VERBAL", "PRE_SYMBOLIC"],
  skillGraphRefs: ["prek-geography-foundations", "ncge-geography-k2", "ncge-geography-3-12"],
  defaultContentPackRefs: ["geography-k-fall-2026"],
  // Honest coverage (remediation Sprint 01): a band is "authored" only when
  // ≥3 real production items back it AND a signed, non-draft skill graph
  // covers it — machine-checked by `pnpm curriculum:coverage`.
  // This subject's item bank has fewer than 3 items at every band (the
  // expansion seed recycles 5 prompts across 20 items), so NO band is
  // production-authored yet. The catalog shows "authoring in progress" and
  // planSession refuses these bands outside preview mode
  // (AIVO_ALLOW_SCAFFOLD_CONTENT). See docs/quality/tutor-k12-coverage-gap-plan.md.
  coverageMatrix: {
    PRE_K: "scaffold",
    K: "scaffold",
    "1": "scaffold",
    "2": "scaffold",
    "3": "scaffold",
    "4": "scaffold",
    "5": "scaffold",
    "6": "scaffold",
    "7": "scaffold",
    "8": "scaffold",
    "9": "scaffold",
    "10": "scaffold",
    "11": "scaffold",
    "12": "scaffold",
  },
  // Wave E (S8): agent loop instruments + per-level action policy.
  toolset: ["get_learner_snapshot", "get_skill_position", "get_curriculum_context"],
  actionPolicy: standardActionPolicy(),
  memoryPolicy: NO_MEMORY,
  policy: {
    requiresConsent: true,
    minAgeYears: 5,
    maxSessionMinutes: 20,
    requirePiiScrubbing: true,
  },
  authoringMeta: {
    owner: "curriculum-geography",
    status: "production",
    aiSvcPersonaKey: "ADDON_TUTOR_SOCIAL_STUDIES",
  },
});

export const GEOGRAPHY_TUTOR_MODE_ID = "geography_tutor" as const;
