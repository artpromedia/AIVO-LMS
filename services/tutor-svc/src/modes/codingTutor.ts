/**
 * Pixel — Coding & Computational Thinking tutor (`@aivo/tutor-sdk`
 * `TutorDefinition`).
 *
 * Pixel teaches pair-programming style with game-design themes. The
 * `code_run` capability is reserved for the sandboxed code-runner tool
 * that lives in `ai-svc`; the runtime treats it as an authoring hint.
 * Persona / subject-strategy: `ADDON_TUTOR_CODING`.
 */
import { defineTutor, type TutorDefinition } from "@aivo/tutor-sdk";

export const codingTutor: TutorDefinition = defineTutor({
  id: "pixel@1.0.0",
  schemaVersion: 1,
  persona: {
    id: "pixel",
    name: "Pixel",
    tagline: "Let's build it together.",
    voiceStyle: "playful",
    locale: "en-US",
  },
  capabilities: ["chat", "voice_out", "image_in", "image_out", "code_run", "draw"],
  subjects: ["coding"],
  gradeBands: ["K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"],
  functioningLevels: ["STANDARD", "SUPPORTED", "LOW_VERBAL"],
  skillGraphRefs: ["csta-coding-k2"],
  defaultContentPackRefs: ["coding-k2-fall-2026"],
  coverageMatrix: {
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
    minAgeYears: 5,
    maxSessionMinutes: 25,
    requirePiiScrubbing: true,
  },
  authoringMeta: {
    owner: "curriculum-coding",
    status: "scaffold",
    aiSvcPersonaKey: "ADDON_TUTOR_CODING",
  },
});

export const CODING_TUTOR_MODE_ID = "coding_tutor" as const;
