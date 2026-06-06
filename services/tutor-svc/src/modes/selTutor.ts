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
  capabilities: ["chat", "agentic_guidance", "voice_out", "image_in", "draw"],
  subjects: ["sel"],
  gradeBands: ["PRE_K", "K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"],
  functioningLevels: ["STANDARD", "SUPPORTED", "LOW_VERBAL", "NON_VERBAL", "PRE_SYMBOLIC"],
  skillGraphRefs: ["prek-sel-foundations", "casel-sel-k2", "casel-sel-3-12"],
  defaultContentPackRefs: ["sel-k2-fall-2026"],
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
