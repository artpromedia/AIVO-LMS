/**
 * Cadence — Music & Rhythm tutor (`@aivo/tutor-sdk` `TutorDefinition`).
 *
 * Cadence teaches via beat, melody, and composition. `voice_out` /
 * `image_out` are declared so the runtime can stream sample-audio /
 * notation imagery from the content pack. Persona / subject-strategy:
 * `ADDON_TUTOR_ARTS`.
 */
import { defineTutor, type TutorDefinition } from "@aivo/tutor-sdk";

export const musicTutor: TutorDefinition = defineTutor({
  id: "cadence@1.0.0",
  schemaVersion: 1,
  persona: {
    id: "cadence",
    name: "Cadence",
    tagline: "Find your rhythm.",
    voiceStyle: "playful",
    locale: "en-US",
  },
  capabilities: ["chat", "agentic_guidance", "voice_in", "voice_out", "image_in", "image_out", "draw"],
  subjects: ["music"],
  gradeBands: ["PRE_K", "K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"],
  functioningLevels: ["STANDARD", "SUPPORTED", "LOW_VERBAL", "NON_VERBAL", "PRE_SYMBOLIC"],
  skillGraphRefs: ["prek-music-foundations", "ncas-music-k2", "ncas-music-3-8", "ncas-music-9-12"],
  defaultContentPackRefs: ["music-k2-fall-2026"],
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
  policy: {
    requiresConsent: true,
    minAgeYears: 4,
    maxSessionMinutes: 20,
    requirePiiScrubbing: true,
  },
  authoringMeta: {
    owner: "curriculum-arts",
    status: "production",
    aiSvcPersonaKey: "ADDON_TUTOR_ARTS",
    subjectBrain: "music",
  },
});

export const MUSIC_TUTOR_MODE_ID = "music_tutor" as const;
