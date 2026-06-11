/**
 * Math tutor — `@aivo/tutor-sdk` `TutorDefinition`.
 *
 * Implements the v2.1 declarative-tutor pattern: per-mode authoring is
 * a `TutorDefinition` (data) consumed by `@aivo/tutor-runtime`, NOT a
 * bespoke runtime. Speech Buddy keeps its dedicated session lifecycle;
 * all domain tutors use the shared agentic runtime.
 *
 * Skill graph ref points at the static CCSS K math graph shipped by
 * `@aivo/skill-graphs` (`ccss-math-k`). The default content-pack ref is
 * the authored and validated `math-k-fall-2026` content pack.
 */
import {
  defineTutor,
  STANDARD_MEMORY,
  standardActionPolicy,
  type TutorDefinition,
} from "@aivo/tutor-sdk";

export const mathTutor: TutorDefinition = defineTutor({
  id: "math-coach@1.0.0",
  schemaVersion: 1,
  persona: {
    id: "nova",
    name: "Nova",
    tagline: "Your guide through the number galaxy.",
    voiceStyle: "playful",
    locale: "en-US",
  },
  capabilities: ["chat", "agentic_guidance", "voice_out", "image_in", "manipulatives", "draw"],
  subjects: ["math"],
  gradeBands: ["PRE_K", "K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"],
  functioningLevels: ["STANDARD", "SUPPORTED", "LOW_VERBAL", "NON_VERBAL"],
  skillGraphRefs: ["prek-math-foundations", "ccss-math-k", "ccss-math-1-8", "ccss-math-9-12"],
  defaultContentPackRefs: ["math-k-fall-2026"],
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
  // S11: onboarded pilots carry the bounded write tools (evidence ledger
  // + parent-approved recommendation proposals).
  toolset: [
    "get_learner_snapshot",
    "get_skill_position",
    "get_curriculum_context",
    "read_math_work",
    "file_evidence",
    "propose_recommendation",
    "remember",
  ],
  actionPolicy: standardActionPolicy(),
  // S12: memory-onboarded pilot — consent-gated episodic memory.
  memoryPolicy: STANDARD_MEMORY,
  policy: {
    // `voice_out` is declared, so consent is required per the SDK
    // validator (`policy_consent_required_for_voice`). The runtime
    // gate for non-Speech-Buddy tutors short-circuits via the same
    // dev-allow-list as Speech Buddy until the generic consent UI
    // ships.
    requiresConsent: true,
    minAgeYears: 4,
    maxSessionMinutes: 15,
    requirePiiScrubbing: true,
  },
  authoringMeta: {
    owner: "curriculum-math",
    status: "production",
    aiSvcPersonaKey: "ADDON_TUTOR_MATH",
  },
});

export const MATH_TUTOR_MODE_ID = "math_coach" as const;
