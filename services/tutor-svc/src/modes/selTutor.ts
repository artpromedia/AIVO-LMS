/**
 * Harmony — Social-Emotional Learning tutor (`@aivo/tutor-sdk`
 * `TutorDefinition`).
 *
 * SEL content can surface trauma-adjacent material; family consent is
 * required and PII scrubbing is mandatory. Persona / subject-strategy:
 * `ADDON_TUTOR_SEL`.
 */
import { defineTutor, type TutorDefinition } from "@aivo/tutor-sdk";

export const selTutor: TutorDefinition = defineTutor({
  id: "harmony@1.0.0",
  schemaVersion: 1,
  persona: {
    id: "harmony",
    name: "Harmony",
    tagline: "All feelings are welcome here.",
    voiceStyle: "calm",
    locale: "en-US",
  },
  capabilities: ["chat", "voice_out", "image_in", "draw"],
  subjects: ["sel"],
  gradeBands: ["PRE_K", "K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"],
  functioningLevels: ["STANDARD", "SUPPORTED", "LOW_VERBAL", "NON_VERBAL", "PRE_SYMBOLIC"],
  skillGraphRefs: ["casel-sel-k2"],
  defaultContentPackRefs: ["sel-k2-fall-2026"],
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
    maxSessionMinutes: 15,
    requirePiiScrubbing: true,
  },
  authoringMeta: {
    owner: "curriculum-sel",
    status: "scaffold",
    aiSvcPersonaKey: "ADDON_TUTOR_SEL",
  },
});

export const SEL_TUTOR_MODE_ID = "sel_tutor" as const;
