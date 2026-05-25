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
  skillGraphRefs: ["c3-social-studies-k2"],
  defaultContentPackRefs: ["history-3-5-fall-2026"],
  coverageMatrix: {
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
