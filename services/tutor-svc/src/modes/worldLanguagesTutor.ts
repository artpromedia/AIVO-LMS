/**
 * Lingua — World Languages tutor (`@aivo/tutor-sdk` `TutorDefinition`).
 *
 * Lingua honours the learner's home language and uses bilingual
 * scaffolding from the Brain language profile. Locale is set to a
 * default English shell; the actual target/home language pair is
 * resolved at session start from `LearnerContext`. Persona /
 * subject-strategy: `ADDON_TUTOR_LANGUAGES`.
 */
import {
  defineTutor,
  NO_MEMORY,
  standardActionPolicy,
  type TutorDefinition,
} from "@aivo/tutor-sdk";

export const worldLanguagesTutor: TutorDefinition = defineTutor({
  id: "lingua@1.0.0",
  schemaVersion: 1,
  persona: {
    id: "lingua",
    name: "Lingua",
    tagline: "Two languages, one journey.",
    voiceStyle: "warm",
    locale: "en-US",
  },
  capabilities: ["chat", "agentic_guidance", "voice_in", "voice_out", "image_in"],
  subjects: ["world_languages"],
  gradeBands: ["PRE_K", "K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"],
  functioningLevels: ["STANDARD", "SUPPORTED", "LOW_VERBAL", "NON_VERBAL"],
  skillGraphRefs: [
    "actfl-world-languages-k-5",
    "prek-world-languages-foundations",
    "actfl-world-languages-novice-low",
    "actfl-world-languages-7-12",
  ],
  defaultContentPackRefs: ["world-languages-novice-low-fall-2026"],
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
  toolset: ["get_learner_snapshot", "get_skill_position", "get_curriculum_context", "score_pronunciation"],
  actionPolicy: standardActionPolicy(),
  memoryPolicy: NO_MEMORY,
  policy: {
    requiresConsent: true,
    minAgeYears: 5,
    maxSessionMinutes: 25,
    requirePiiScrubbing: true,
  },
  authoringMeta: {
    owner: "curriculum-languages",
    status: "production",
    aiSvcPersonaKey: "ADDON_TUTOR_LANGUAGES",
  },
});

export const WORLD_LANGUAGES_TUTOR_MODE_ID = "world_languages_tutor" as const;
