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
  STANDARD_MEMORY,
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
  // Honest coverage (remediation Sprint 01): a band is "authored" only when
  // ≥3 real production items back it AND a signed, non-draft skill graph
  // covers it — machine-checked by `pnpm curriculum:coverage`. ela+writing
  // items exist K-8; PRE_K rides on a 0.1.0-draft foundations graph and
  // 9-12 has no item-bank content yet, so those bands are honestly
  // "scaffold" until authored (docs/quality/tutor-k12-coverage-gap-plan.md).
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
  },
  // Wave E (S8): agent loop instruments + per-level action policy.
  // S11: onboarded pilots carry the bounded write tools (evidence ledger
  // + parent-approved recommendation proposals).
  toolset: [
    "get_learner_snapshot",
    "get_skill_position",
    "get_curriculum_context",
    "file_evidence",
    "propose_recommendation",
    "remember",
  ],
  actionPolicy: standardActionPolicy(),
  // S12: memory-onboarded pilot — consent-gated episodic memory.
  memoryPolicy: STANDARD_MEMORY,
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
