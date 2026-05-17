/**
 * Sage — English Language Arts tutor (`@aivo/tutor-sdk` `TutorDefinition`).
 *
 * Sage is a narrative-driven ELA tutor that turns reading and writing
 * into adventures. Personality + subject-strategy live in
 * `services/ai-svc/src/ai_svc/prompts/tutor_personas.py` under
 * `ADDON_TUTOR_ELA`; this declaration wires Sage into the runtime so
 * `planSession()` can adapt activities to the learner's profile.
 */
import { defineTutor, type TutorDefinition } from "@aivo/tutor-sdk";

export const elaTutor: TutorDefinition = defineTutor({
  id: "sage@1.0.0",
  schemaVersion: 1,
  persona: {
    id: "sage",
    name: "Sage",
    tagline: "Where stories meet your voice.",
    voiceStyle: "warm",
    locale: "en-US",
  },
  capabilities: ["chat", "voice_in", "voice_out", "image_in", "draw"],
  subjects: ["ela"],
  gradeBands: ["PRE_K", "K", "1", "2", "3", "4", "5"],
  functioningLevels: ["STANDARD", "SUPPORTED", "LOW_VERBAL", "NON_VERBAL", "PRE_SYMBOLIC"],
  skillGraphRefs: ["ccss-ela-k"],
  defaultContentPackRefs: ["ela-k-fall-2026"],
  policy: {
    requiresConsent: true,
    minAgeYears: 4,
    maxSessionMinutes: 20,
    requirePiiScrubbing: true,
  },
  authoringMeta: {
    owner: "curriculum-ela",
    status: "scaffold",
    aiSvcPersonaKey: "ADDON_TUTOR_ELA",
  },
});

export const ELA_TUTOR_MODE_ID = "ela_tutor" as const;
