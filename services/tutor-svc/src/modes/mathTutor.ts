/**
 * Math tutor — `@aivo/tutor-sdk` `TutorDefinition`.
 *
 * Demonstrates the v2.1 declarative-tutor pattern: per-mode authoring is
 * a `TutorDefinition` (data) consumed by `@aivo/tutor-runtime`, NOT a
 * bespoke `*.ts` per mode under `services/tutor-svc/src/modes/`. The
 * existing `speechBuddy.ts` is an interface-only scaffold for the pre-SDK
 * Speech Buddy session lifecycle and is preserved for that path; new
 * tutors should follow the shape below.
 *
 * Skill graph ref points at the static CCSS K math graph shipped by
 * `@aivo/skill-graphs` (`ccss-math-k`). The default content-pack ref is
 * the placeholder `math-k-fall-2026` pack id; the actual pack is
 * authored separately and validated against `@aivo/content-pack`.
 *
 * NOTE: Authoring the full 14-tutor catalog is curriculum work that
 * lives outside the engineering tree. This file is the engineering
 * proof-of-wiring: it imports `defineTutor`, types check, and the
 * runtime can load the resulting `TutorDefinition` value.
 */
import { defineTutor, type TutorDefinition } from "@aivo/tutor-sdk";

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
  capabilities: ["chat", "voice_out", "image_in", "manipulatives", "draw"],
  subjects: ["math"],
  gradeBands: ["PRE_K", "K", "1", "2"],
  functioningLevels: ["STANDARD", "SUPPORTED", "LOW_VERBAL", "NON_VERBAL"],
  skillGraphRefs: ["ccss-math-k"],
  defaultContentPackRefs: ["math-k-fall-2026"],
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
    status: "scaffold",
    aiSvcPersonaKey: "ADDON_TUTOR_MATH",
  },
});

export const MATH_TUTOR_MODE_ID = "math_coach" as const;
