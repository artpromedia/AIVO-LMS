/**
 * Forge — STEM & Engineering Design tutor (`@aivo/tutor-sdk`
 * `TutorDefinition`).
 *
 * Forge runs the engineering-design loop (Ask → Imagine → Plan →
 * Create → Test → Improve). `manipulatives` is declared because Forge
 * leans heavily on physical / virtual building. Persona /
 * subject-strategy: `ADDON_TUTOR_STEM_DESIGN`.
 */
import { defineTutor, type TutorDefinition } from "@aivo/tutor-sdk";

export const stemEngineeringTutor: TutorDefinition = defineTutor({
  id: "forge@1.0.0",
  schemaVersion: 1,
  persona: {
    id: "forge",
    name: "Forge",
    tagline: "Build it. Test it. Improve it.",
    voiceStyle: "playful",
    locale: "en-US",
  },
  capabilities: ["chat", "voice_out", "image_in", "image_out", "manipulatives", "draw", "code_run"],
  subjects: ["stem_engineering"],
  gradeBands: ["3", "4", "5", "6", "7", "8", "9", "10", "11", "12"],
  functioningLevels: ["STANDARD", "SUPPORTED", "LOW_VERBAL", "NON_VERBAL", "PRE_SYMBOLIC"],
  skillGraphRefs: ["ngss-engineering-design-3-5"],
  defaultContentPackRefs: ["stem-engineering-3-5-fall-2026"],
  policy: {
    requiresConsent: true,
    minAgeYears: 8,
    maxSessionMinutes: 30,
    requirePiiScrubbing: true,
  },
  authoringMeta: {
    owner: "curriculum-stem",
    status: "alpha",
    aiSvcPersonaKey: "ADDON_TUTOR_STEM_DESIGN",
    subjectBrain: "stem_engineering",
  },
});

export const STEM_ENGINEERING_TUTOR_MODE_ID = "stem_engineering_tutor" as const;
