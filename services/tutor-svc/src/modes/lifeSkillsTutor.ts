/**
 * Compass — Life Skills & Executive Function tutor (`@aivo/tutor-sdk`
 * `TutorDefinition`).
 *
 * Compass activates the transition-planning module from age 14 forward.
 * Family consent is required because the planner reads vocational and
 * community-participation context that may include identifiable
 * caregiver information. Persona / subject-strategy:
 * `ADDON_TUTOR_LIFE_SKILLS`.
 */
import { defineTutor, type TutorDefinition } from "@aivo/tutor-sdk";

export const lifeSkillsTutor: TutorDefinition = defineTutor({
  id: "compass@1.0.0",
  schemaVersion: 1,
  persona: {
    id: "compass",
    name: "Compass",
    tagline: "One step at a time, you've got this.",
    voiceStyle: "calm",
    locale: "en-US",
  },
  capabilities: ["chat", "agentic_guidance", "voice_in", "voice_out", "image_in", "image_out"],
  subjects: ["life_skills", "executive_function"],
  gradeBands: ["PRE_K", "K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "ADULT"],
  functioningLevels: ["STANDARD", "SUPPORTED", "LOW_VERBAL", "NON_VERBAL", "PRE_SYMBOLIC"],
  skillGraphRefs: [
    "cec-life-skills-k-5",
    "cec-executive-function-k-12",
    "prek-life-skills-foundations",
    "prek-executive-function-foundations",
    "cec-life-skills-6-plus",
    "cec-life-skills-9-12",
  ],
  defaultContentPackRefs: ["life-skills-6-plus-fall-2026"],
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
    ADULT: "scaffold",
  },
  policy: {
    requiresConsent: true,
    minAgeYears: 5,
    maxSessionMinutes: 30,
    requirePiiScrubbing: true,
  },
  authoringMeta: {
    owner: "curriculum-life-skills",
    status: "production",
    aiSvcPersonaKey: "ADDON_TUTOR_LIFE_SKILLS",
    transitionPlanningFromAge: "14",
  },
});

export const LIFE_SKILLS_TUTOR_MODE_ID = "life_skills_tutor" as const;
