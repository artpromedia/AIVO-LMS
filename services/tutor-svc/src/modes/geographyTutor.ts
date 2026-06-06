/**
 * Atlas — Geography & World Cultures tutor (`@aivo/tutor-sdk`
 * `TutorDefinition`).
 *
 * Atlas frames lessons as expeditions across continents. Persona /
 * subject-strategy: `ADDON_TUTOR_SOCIAL_STUDIES` (the persona file
 * keeps Atlas under the social-studies bucket; the runtime classifies
 * the subject as `geography` for skill-graph routing).
 */
import { defineTutor, type TutorDefinition } from "@aivo/tutor-sdk";

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
  defaultContentPackRefs: ["geography-k2-fall-2026"],
  coverageMatrix: {
    PRE_K: "scaffold",
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
  policy: {
    requiresConsent: true,
    minAgeYears: 5,
    maxSessionMinutes: 20,
    requirePiiScrubbing: true,
  },
  authoringMeta: {
    owner: "curriculum-geography",
    status: "scaffold",
    aiSvcPersonaKey: "ADDON_TUTOR_SOCIAL_STUDIES",
  },
});

export const GEOGRAPHY_TUTOR_MODE_ID = "geography_tutor" as const;
