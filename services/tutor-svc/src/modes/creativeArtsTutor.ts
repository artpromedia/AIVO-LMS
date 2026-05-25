/**
 * Muse — Creative Arts & Expression tutor (`@aivo/tutor-sdk`
 * `TutorDefinition`).
 *
 * Muse inspires writing, storytelling, and portfolio building. Image-
 * out is declared so the runtime can stream cover art / illustrations
 * from the content pack. Persona / subject-strategy:
 * `ADDON_TUTOR_CREATIVE_WRITING`.
 */
import { defineTutor, type TutorDefinition } from "@aivo/tutor-sdk";

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
  capabilities: ["chat", "voice_in", "voice_out", "image_in", "image_out", "draw"],
  subjects: ["creative_arts"],
  gradeBands: ["K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"],
  functioningLevels: ["STANDARD", "SUPPORTED", "LOW_VERBAL", "NON_VERBAL", "PRE_SYMBOLIC"],
  skillGraphRefs: ["ncas-creative-arts-k2", "ncas-creative-arts-3-12"],
  defaultContentPackRefs: ["creative-arts-k2-fall-2026"],
  coverageMatrix: {
    K: "authored",
    "1": "authored",
    "2": "authored",
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
  policy: {
    requiresConsent: true,
    minAgeYears: 5,
    maxSessionMinutes: 25,
    requirePiiScrubbing: true,
  },
  authoringMeta: {
    owner: "curriculum-creative-arts",
    status: "scaffold",
    aiSvcPersonaKey: "ADDON_TUTOR_CREATIVE_WRITING",
  },
});

export const CREATIVE_ARTS_TUTOR_MODE_ID = "creative_arts_tutor" as const;
