/**
 * Chrono — History & Social Studies tutor (`@aivo/tutor-sdk` `TutorDefinition`).
 *
 * Chrono uses time-travel narratives and primary-source analysis. Per
 * the brand catalog Chrono is gated to MIDDLE+HIGH tiers, so we ship
 * grade bands 3+ here. Persona / subject-strategy:
 * `ADDON_TUTOR_HISTORY` in `ai-svc` `tutor_personas.py`.
 */
import {
  defineTutor,
  NO_MEMORY,
  standardActionPolicy,
  type TutorDefinition,
} from "@aivo/tutor-sdk";

export const historyTutor: TutorDefinition = defineTutor({
  id: "chrono@1.0.0",
  schemaVersion: 1,
  persona: {
    id: "chrono",
    name: "Chrono",
    tagline: "Step into the timeline.",
    voiceStyle: "calm",
    locale: "en-US",
  },
  capabilities: ["chat", "agentic_guidance", "voice_out", "image_in", "draw"],
  subjects: ["social_studies"],
  gradeBands: ["PRE_K", "K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"],
  functioningLevels: ["STANDARD", "SUPPORTED", "LOW_VERBAL", "NON_VERBAL"],
  skillGraphRefs: [
    "prek-social-studies-foundations",
    "c3-social-studies-k2",
    "c3-social-studies-3-8",
    "c3-social-studies-9-12",
  ],
  defaultContentPackRefs: ["social-studies-k-fall-2026"],
  // Honest coverage (remediation Sprint 01): a band is "authored" only when
  // ≥3 real production items back it AND a signed, non-draft skill graph
  // covers it — machine-checked by `pnpm curriculum:coverage`.
  // This subject's item bank has fewer than 3 items at every band (the
  // expansion seed recycles 5 prompts across 20 items), so NO band is
  // production-authored yet. The catalog shows "authoring in progress" and
  // planSession refuses these bands outside preview mode
  // (AIVO_ALLOW_SCAFFOLD_CONTENT). See docs/quality/tutor-k12-coverage-gap-plan.md.
  coverageMatrix: {
    PRE_K: "scaffold",
    K: "scaffold",
    "1": "scaffold",
    "2": "scaffold",
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
  toolset: ["get_learner_snapshot", "get_skill_position", "get_curriculum_context", "file_evidence", "propose_recommendation"],
  actionPolicy: standardActionPolicy(),
  memoryPolicy: NO_MEMORY,
  policy: {
    requiresConsent: true,
    minAgeYears: 5,
    maxSessionMinutes: 25,
    requirePiiScrubbing: true,
  },
  authoringMeta: {
    owner: "curriculum-social-studies",
    status: "production",
    aiSvcPersonaKey: "ADDON_TUTOR_HISTORY",
  },
});

export const HISTORY_TUTOR_MODE_ID = "history_tutor" as const;
