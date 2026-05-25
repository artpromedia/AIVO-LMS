/**
 * Chrono — History & Social Studies tutor (`@aivo/tutor-sdk` `TutorDefinition`).
 *
 * Chrono uses time-travel narratives and primary-source analysis. Per
 * the brand catalog Chrono is gated to MIDDLE+HIGH tiers, so we ship
 * grade bands 3+ here. Persona / subject-strategy:
 * `ADDON_TUTOR_HISTORY` in `ai-svc` `tutor_personas.py`.
 */
import { defineTutor, type TutorDefinition } from "@aivo/tutor-sdk";

export const historyTutor: TutorDefinition = defineTutor({
  id: "chrono@1.0.0",
  schemaVersion: 1,
  persona: {
    id: "chrono",
    name: "Chrono",
    tagline: "Step into the timeline.",
    voiceStyle: "calm",
    locale: "en-US",
  },
  capabilities: ["chat", "voice_out", "image_in", "draw"],
  subjects: ["social_studies"],
  gradeBands: ["3", "4", "5", "6", "7", "8", "9", "10", "11", "12"],
  functioningLevels: ["STANDARD", "SUPPORTED", "LOW_VERBAL", "NON_VERBAL"],
  skillGraphRefs: [
    "c3-social-studies-k2",
    "c3-social-studies-3-8",
    "c3-social-studies-9-12",
  ],
  defaultContentPackRefs: ["history-3-5-fall-2026"],
  coverageMatrix: {
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
    minAgeYears: 8,
    maxSessionMinutes: 25,
    requirePiiScrubbing: true,
  },
  authoringMeta: {
    owner: "curriculum-social-studies",
    status: "scaffold",
    aiSvcPersonaKey: "ADDON_TUTOR_HISTORY",
  },
});

export const HISTORY_TUTOR_MODE_ID = "history_tutor" as const;
