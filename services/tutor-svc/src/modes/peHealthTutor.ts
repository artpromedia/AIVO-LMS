/**
 * Vigor — Physical Education & Health tutor (`@aivo/tutor-sdk`
 * `TutorDefinition`).
 *
 * Vigor surfaces three tracks (general PE, health, DAPE) — the
 * planner reads `dape_profile` from the learner profile to switch
 * tracks. Persona / subject-strategy: `ADDON_TUTOR_PE_HEALTH`.
 */
import {
  defineTutor,
  NO_MEMORY,
  standardActionPolicy,
  type TutorDefinition,
} from "@aivo/tutor-sdk";

export const peHealthTutor: TutorDefinition = defineTutor({
  id: "vigor@1.0.0",
  schemaVersion: 1,
  persona: {
    id: "vigor",
    name: "Vigor",
    tagline: "Move, learn, grow.",
    voiceStyle: "playful",
    locale: "en-US",
  },
  capabilities: ["chat", "agentic_guidance", "voice_out", "image_in", "image_out", "draw"],
  subjects: ["pe_health"],
  gradeBands: ["PRE_K", "K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"],
  functioningLevels: ["STANDARD", "SUPPORTED", "LOW_VERBAL", "NON_VERBAL", "PRE_SYMBOLIC"],
  skillGraphRefs: ["prek-pe-health-foundations", "shape-pe-health-k2", "shape-pe-health-3-12"],
  defaultContentPackRefs: ["pe-health-k2-fall-2026"],
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
    minAgeYears: 4,
    maxSessionMinutes: 25,
    requirePiiScrubbing: true,
  },
  authoringMeta: {
    owner: "curriculum-pe-health",
    status: "production",
    aiSvcPersonaKey: "ADDON_TUTOR_PE_HEALTH",
    subjectBrain: "pe_health",
    tracks: "fitness,health,dape",
  },
});

export const PE_HEALTH_TUTOR_MODE_ID = "pe_health_tutor" as const;
