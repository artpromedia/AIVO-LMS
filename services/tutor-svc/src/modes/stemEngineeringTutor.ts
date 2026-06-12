/**
 * Forge — STEM & Engineering Design tutor (`@aivo/tutor-sdk`
 * `TutorDefinition`).
 *
 * Forge runs the engineering-design loop (Ask → Imagine → Plan →
 * Create → Test → Improve). `manipulatives` is declared because Forge
 * leans heavily on physical / virtual building. Persona /
 * subject-strategy: `ADDON_TUTOR_STEM_DESIGN`.
 */
import {
  defineTutor,
  NO_MEMORY,
  standardActionPolicy,
  type TutorDefinition,
} from "@aivo/tutor-sdk";

export const stemEngineeringTutor: TutorDefinition = defineTutor({
  id: "forge@1.0.0",
  schemaVersion: 1,
  persona: {
    id: "forge",
    name: "Forge",
    tagline: "Build it. Test it. Improve it.",
    voiceStyle: "playful",
    locale: "en-US",
  },
  capabilities: ["chat", "agentic_guidance", "voice_out", "image_in", "image_out", "manipulatives", "draw", "code_run"],
  subjects: ["stem_engineering"],
  gradeBands: ["PRE_K", "K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"],
  functioningLevels: ["STANDARD", "SUPPORTED", "LOW_VERBAL", "NON_VERBAL", "PRE_SYMBOLIC"],
  skillGraphRefs: [
    "ngss-engineering-design-k-2",
    "prek-stem-engineering-foundations",
    "ngss-engineering-design-3-5",
    "ngss-engineering-design-6-12",
  ],
  defaultContentPackRefs: ["stem-engineering-3-5-fall-2026"],
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
    maxSessionMinutes: 30,
    requirePiiScrubbing: true,
  },
  authoringMeta: {
    owner: "curriculum-stem",
    status: "production",
    aiSvcPersonaKey: "ADDON_TUTOR_STEM_DESIGN",
    subjectBrain: "stem_engineering",
  },
});

export const STEM_ENGINEERING_TUTOR_MODE_ID = "stem_engineering_tutor" as const;
