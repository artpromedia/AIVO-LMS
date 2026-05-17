/**
 * Spark — Science tutor (`@aivo/tutor-sdk` `TutorDefinition`).
 *
 * Spark is experiment-first: every session is framed as a discovery.
 * Persona / subject-strategy: `ADDON_TUTOR_SCIENCE` in `ai-svc`
 * `tutor_personas.py`. The runtime drives planning over the seeded
 * NGSS K–2 Physical Science graph; deeper grade bands ship with
 * subsequent NGSS content packs.
 */
import { defineTutor, type TutorDefinition } from "@aivo/tutor-sdk";

export const scienceTutor: TutorDefinition = defineTutor({
  id: "spark@1.0.0",
  schemaVersion: 1,
  persona: {
    id: "spark",
    name: "Spark",
    tagline: "Curiosity is the experiment.",
    voiceStyle: "playful",
    locale: "en-US",
  },
  capabilities: ["chat", "voice_out", "image_in", "image_out", "manipulatives", "draw"],
  subjects: ["science"],
  gradeBands: ["K", "1", "2", "3", "4", "5"],
  functioningLevels: ["STANDARD", "SUPPORTED", "LOW_VERBAL", "NON_VERBAL", "PRE_SYMBOLIC"],
  skillGraphRefs: ["ngss-k2-physical-science"],
  defaultContentPackRefs: ["science-k2-fall-2026"],
  policy: {
    requiresConsent: true,
    minAgeYears: 5,
    maxSessionMinutes: 20,
    requirePiiScrubbing: true,
  },
  authoringMeta: {
    owner: "curriculum-science",
    status: "scaffold",
    aiSvcPersonaKey: "ADDON_TUTOR_SCIENCE",
  },
});

export const SCIENCE_TUTOR_MODE_ID = "science_tutor" as const;
