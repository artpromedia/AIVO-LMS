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
  capabilities: ["chat", "voice_in", "voice_out", "image_in"],
  subjects: ["world_languages"],
  gradeBands: ["6", "7", "8", "9", "10", "11", "12"],
  functioningLevels: ["STANDARD", "SUPPORTED", "LOW_VERBAL", "NON_VERBAL"],
  skillGraphRefs: ["actfl-world-languages-novice-low", "actfl-world-languages-7-12"],
  defaultContentPackRefs: ["world-languages-novice-low-fall-2026"],
  coverageMatrix: {
    "6": "authored",
    "7": "scaffold",
    "8": "scaffold",
    "9": "scaffold",
    "10": "scaffold",
    "11": "scaffold",
    "12": "scaffold",
  },
  policy: {
    requiresConsent: true,
    minAgeYears: 11,
    maxSessionMinutes: 25,
    requirePiiScrubbing: true,
  },
  authoringMeta: {
    owner: "curriculum-languages",
    status: "scaffold",
    aiSvcPersonaKey: "ADDON_TUTOR_LANGUAGES",
  },
});

export const WORLD_LANGUAGES_TUTOR_MODE_ID = "world_languages_tutor" as const;
