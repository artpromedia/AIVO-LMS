/**
 * Sage — English Language Arts tutor (`@aivo/tutor-sdk` `TutorDefinition`).
 *
 * Sage is a narrative-driven ELA tutor that turns reading and writing
 * into adventures. Personality + subject-strategy live in
 * `services/ai-svc/src/ai_svc/prompts/tutor_personas.py` under
 * `ADDON_TUTOR_ELA`; this declaration wires Sage into the runtime so
 * `planSession()` can adapt activities to the learner's profile.
 */
import {
  defineTutor,
  NO_MEMORY,
  standardActionPolicy,
  type TutorDefinition,
} from "@aivo/tutor-sdk";

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
  capabilities: ["chat", "agentic_guidance", "voice_in", "voice_out", "image_in", "draw"],
  subjects: ["ela", "writing"],
  gradeBands: ["PRE_K", "K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"],
  functioningLevels: ["STANDARD", "SUPPORTED", "LOW_VERBAL", "NON_VERBAL", "PRE_SYMBOLIC"],
  skillGraphRefs: [
    "ccss-ela-k",
    "prek-ela-foundations",
    "prek-writing-foundations",
    "ccss-ela-1-8",
    "ccss-writing-k-8",
    "ccss-ela-9-12",
    "ccss-writing-9-12",
  ],
  defaultContentPackRefs: ["ela-k-fall-2026"],
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
  // Wave E (S8): agent loop instruments + per-level action policy.
  toolset: ["get_learner_snapshot", "get_skill_position", "get_curriculum_context"],
  actionPolicy: standardActionPolicy(),
  memoryPolicy: NO_MEMORY,
  policy: {
    requiresConsent: true,
    minAgeYears: 4,
    maxSessionMinutes: 20,
    requirePiiScrubbing: true,
  },
  authoringMeta: {
    owner: "curriculum-ela",
    status: "production",
    aiSvcPersonaKey: "ADDON_TUTOR_ELA",
  },
});

export const ELA_TUTOR_MODE_ID = "ela_tutor" as const;
