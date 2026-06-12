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
import {
  defineTutor,
  NO_MEMORY,
  standardActionPolicy,
  type TutorDefinition,
} from "@aivo/tutor-sdk";

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
  // Honest coverage (remediation Sprint 01): a band is "authored" only when
  // ≥3 real production items back it AND a signed, non-draft skill graph
  // covers it — machine-checked by `pnpm curriculum:coverage`.
  // life_skills + executive_function items together clear the bar K-8;
  // PRE_K (draft foundations graph) and 9-12 (too few items) are
  // honestly "scaffold" until authored
  // (docs/quality/tutor-k12-coverage-gap-plan.md).
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
    "9": "scaffold",
    "10": "scaffold",
    "11": "scaffold",
    "12": "scaffold",
    // production-gap-gate:allow-scaffold(ADULT) owner=curriculum-life-skills date=2026-06-10
    // ADULT transition content is attested out of GA scope. The band stays
    // declared so authors can preview it (AIVO_ALLOW_SCAFFOLD_CONTENT=true),
    // and planSession refuses it in production — fail-closed, regression-
    // tested in tests/tutor-session-route.test.ts (refused by default,
    // plannable only under the preview flag).
    ADULT: "scaffold",
  },
  // Wave E (S8): agent loop instruments + per-level action policy.
  toolset: ["get_learner_snapshot", "get_skill_position", "get_curriculum_context", "break_down_task"],
  actionPolicy: standardActionPolicy(),
  memoryPolicy: NO_MEMORY,
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
