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
  capabilities: ["chat", "voice_out", "image_in", "image_out", "draw"],
  subjects: ["geography"],
  gradeBands: ["K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"],
  functioningLevels: ["STANDARD", "SUPPORTED", "LOW_VERBAL", "NON_VERBAL", "PRE_SYMBOLIC"],
  skillGraphRefs: ["ncge-geography-k2"],
  defaultContentPackRefs: ["geography-k2-fall-2026"],
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
