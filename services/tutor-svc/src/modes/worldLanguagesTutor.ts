/**
 * Lingua — World Languages tutor (`@aivo/tutor-sdk` `TutorDefinition`).
 *
 * Lingua honours the learner's home language and uses bilingual
 * scaffolding from the Brain language profile. Locale is set to a
 * default English shell; the actual target/home language pair is
 * resolved at session start from `LearnerContext`. Persona /
 * subject-strategy: `ADDON_TUTOR_LANGUAGES`.
 */
import { defineTutor, type TutorDefinition } from "@aivo/tutor-sdk";

export const worldLanguagesTutor: TutorDefinition = defineTutor({
  id: "lingua@1.0.0",
  schemaVersion: 1,
  persona: {
    id: "lingua",
    name: "Lingua",
    tagline: "Two languages, one journey.",
    voiceStyle: "warm",
    locale: "en-US",
  },
  capabilities: ["chat", "agentic_guidance", "voice_in", "voice_out", "image_in"],
  subjects: ["world_languages"],
  gradeBands: ["PRE_K", "K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"],
  functioningLevels: ["STANDARD", "SUPPORTED", "LOW_VERBAL", "NON_VERBAL"],
  skillGraphRefs: [
    "actfl-world-languages-k-5",
    "prek-world-languages-foundations",
    "actfl-world-languages-novice-low",
    "actfl-world-languages-7-12",
  ],
  defaultContentPackRefs: ["world-languages-novice-low-fall-2026"],
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
    minAgeYears: 5,
    maxSessionMinutes: 25,
    requirePiiScrubbing: true,
  },
  authoringMeta: {
    owner: "curriculum-languages",
    status: "production",
    aiSvcPersonaKey: "ADDON_TUTOR_LANGUAGES",
  },
});

export const WORLD_LANGUAGES_TUTOR_MODE_ID = "world_languages_tutor" as const;
