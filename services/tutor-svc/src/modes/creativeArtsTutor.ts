/**
 * Muse — Creative Arts & Expression tutor (`@aivo/tutor-sdk`
 * `TutorDefinition`).
 *
 * Muse inspires writing, storytelling, and portfolio building. Image-
 * out is declared so the runtime can stream cover art / illustrations
 * from the content pack. Persona / subject-strategy:
 * `ADDON_TUTOR_CREATIVE_WRITING`.
 */
import {
  defineTutor,
  NO_MEMORY,
  standardActionPolicy,
  type TutorDefinition,
} from "@aivo/tutor-sdk";

export const creativeArtsTutor: TutorDefinition = defineTutor({
  id: "muse@1.0.0",
  schemaVersion: 1,
  persona: {
    id: "muse",
    name: "Muse",
    tagline: "Your voice, your story.",
    voiceStyle: "warm",
    locale: "en-US",
  },
  capabilities: ["chat", "agentic_guidance", "voice_in", "voice_out", "image_in", "image_out", "draw"],
  subjects: ["creative_arts"],
  gradeBands: ["PRE_K", "K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"],
  functioningLevels: ["STANDARD", "SUPPORTED", "LOW_VERBAL", "NON_VERBAL", "PRE_SYMBOLIC"],
  skillGraphRefs: [
    "prek-creative-arts-foundations",
    "ncas-creative-arts-k2",
    "ncas-creative-arts-3-12",
  ],
  defaultContentPackRefs: ["creative-arts-k2-fall-2026"],
  coverageMatrix: {
    PRE_K: "authored",
    K: "authored",
    "1": "authored",
    "2": "authored",
    "3": "authored",
    "4": "authored",
    "5": "authored",
    "6": "authored",
    "7": "authored",
    "8": "authored",
    "9": "authored",
    "10": "authored",
    "11": "authored",
    "12": "authored",
  },
  // Wave E (S8): agent loop instruments + per-level action policy.
  toolset: ["get_learner_snapshot", "get_skill_position", "get_curriculum_context"],
  actionPolicy: standardActionPolicy(),
  memoryPolicy: NO_MEMORY,
  policy: {
    requiresConsent: true,
    minAgeYears: 5,
    maxSessionMinutes: 25,
    requirePiiScrubbing: true,
  },
  authoringMeta: {
    owner: "curriculum-creative-arts",
    status: "production",
    aiSvcPersonaKey: "ADDON_TUTOR_CREATIVE_WRITING",
    subjectBrain: "creative_arts",
  },
});

export const CREATIVE_ARTS_TUTOR_MODE_ID = "creative_arts_tutor" as const;
