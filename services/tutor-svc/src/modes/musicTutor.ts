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
  capabilities: ["chat", "voice_in", "voice_out", "image_in", "image_out", "draw"],
  subjects: ["music"],
  gradeBands: ["PRE_K", "K", "1", "2", "3", "4", "5", "6", "7", "8"],
  functioningLevels: ["STANDARD", "SUPPORTED", "LOW_VERBAL", "NON_VERBAL", "PRE_SYMBOLIC"],
  skillGraphRefs: ["ncas-music-k2"],
  defaultContentPackRefs: ["music-k2-fall-2026"],
  policy: {
    requiresConsent: true,
    minAgeYears: 4,
    maxSessionMinutes: 20,
    requirePiiScrubbing: true,
  },
  authoringMeta: {
    owner: "curriculum-arts",
    status: "scaffold",
    aiSvcPersonaKey: "ADDON_TUTOR_ARTS",
  },
});

export const MUSIC_TUTOR_MODE_ID = "music_tutor" as const;
