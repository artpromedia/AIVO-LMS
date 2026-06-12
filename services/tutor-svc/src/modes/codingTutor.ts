/**
 * Pixel — Coding & Computational Thinking tutor (`@aivo/tutor-sdk`
 * `TutorDefinition`).
 *
 * Pixel teaches pair-programming style with game-design themes. The
 * `code_run` capability is reserved for the sandboxed code-runner tool
 * that lives in `ai-svc`; the runtime treats it as an authoring hint.
 * Persona / subject-strategy: `ADDON_TUTOR_CODING`.
 */
import {
  defineTutor,
  NO_MEMORY,
  standardActionPolicy,
  type TutorDefinition,
} from "@aivo/tutor-sdk";

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
  capabilities: ["chat", "agentic_guidance", "voice_out", "image_in", "image_out", "code_run", "draw"],
  subjects: ["coding"],
  gradeBands: ["PRE_K", "K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"],
  functioningLevels: ["STANDARD", "SUPPORTED", "LOW_VERBAL"],
  skillGraphRefs: ["prek-coding-foundations", "csta-coding-k2", "csta-coding-3-12"],
  defaultContentPackRefs: ["coding-k2-fall-2026", "coding-1-fall-2026", "coding-2-fall-2026"],
  // Honest coverage (remediation Sprint 01): a band is "authored" only when
  // ≥3 real production items back it AND a signed, non-draft skill graph
  // covers it — machine-checked by `pnpm curriculum:coverage`.
  // This subject's item bank has fewer than 3 items at every band (the
  // expansion seed recycles 5 prompts across 20 items), so NO band is
  // production-authored yet. The catalog shows "authoring in progress" and
  // planSession refuses these bands outside preview mode
  // (AIVO_ALLOW_SCAFFOLD_CONTENT). See docs/quality/tutor-k12-coverage-gap-plan.md.
  // Sprint 09: K-2 flipped to authored LEGITIMATELY — real coding-k2/1/2
  // packs + >=3 pack-aligned production items per band now back them
  // (machine-checked by curriculum:coverage's promotion guard).
  coverageMatrix: {
    PRE_K: "scaffold",
    K: "authored",
    "1": "authored",
    "2": "authored",
    "3": "scaffold",
    "4": "scaffold",
    "5": "scaffold",
    "6": "scaffold",
    "7": "scaffold",
    "8": "scaffold",
    "9": "scaffold",
    "10": "scaffold",
    "11": "scaffold",
    "12": "scaffold",
  },
  // Wave E (S8): agent loop instruments + per-level action policy.
  toolset: ["get_learner_snapshot", "get_skill_position", "get_curriculum_context"],
  actionPolicy: standardActionPolicy(),
  memoryPolicy: NO_MEMORY,
  policy: {
    requiresConsent: true,
    minAgeYears: 5,
    maxSessionMinutes: 25,
    requirePiiScrubbing: true,
  },
  authoringMeta: {
    owner: "curriculum-coding",
    status: "production",
    aiSvcPersonaKey: "ADDON_TUTOR_CODING",
    subjectBrain: "coding",
  },
});

export const CODING_TUTOR_MODE_ID = "coding_tutor" as const;
