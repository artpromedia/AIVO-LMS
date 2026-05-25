/**
 * Vigor — Physical Education & Health tutor (`@aivo/tutor-sdk`
 * `TutorDefinition`).
 *
 * Vigor surfaces three tracks (general PE, health, DAPE) — the
 * planner reads `dape_profile` from the learner profile to switch
 * tracks. Persona / subject-strategy: `ADDON_TUTOR_PE_HEALTH`.
 */
import { defineTutor, type TutorDefinition } from "@aivo/tutor-sdk";

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
  capabilities: ["chat", "voice_out", "image_in", "image_out", "draw"],
  subjects: ["pe_health"],
  gradeBands: ["PRE_K", "K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"],
  functioningLevels: ["STANDARD", "SUPPORTED", "LOW_VERBAL", "NON_VERBAL", "PRE_SYMBOLIC"],
  skillGraphRefs: ["shape-pe-health-k2"],
  defaultContentPackRefs: ["pe-health-k2-fall-2026"],
  coverageMatrix: {
    PRE_K: "scaffold",
    K: "authored",
    "1": "authored",
    "2": "authored",
    "3": "missing",
    "4": "missing",
    "5": "missing",
    "6": "missing",
    "7": "missing",
    "8": "missing",
    "9": "missing",
    "10": "missing",
    "11": "missing",
    "12": "missing",
  },
  policy: {
    requiresConsent: true,
    minAgeYears: 4,
    maxSessionMinutes: 25,
    requirePiiScrubbing: true,
  },
  authoringMeta: {
    owner: "curriculum-pe-health",
    status: "scaffold",
    aiSvcPersonaKey: "ADDON_TUTOR_PE_HEALTH",
    tracks: "fitness,health,dape",
  },
});

export const PE_HEALTH_TUTOR_MODE_ID = "pe_health_tutor" as const;
