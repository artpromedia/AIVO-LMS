/**
 * Spark — Science tutor (`@aivo/tutor-sdk` `TutorDefinition`).
 *
 * Spark is experiment-first: every session is framed as a discovery.
 * Persona / subject-strategy: `ADDON_TUTOR_SCIENCE` in `ai-svc`
 * `tutor_personas.py`. The runtime drives planning over the seeded
 * NGSS K–2 Physical Science graph; deeper grade bands ship with
 * subsequent NGSS content packs.
 */
import {
  defineTutor,
  NO_MEMORY,
  standardActionPolicy,
  type TutorDefinition,
} from "@aivo/tutor-sdk";

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
  capabilities: ["chat", "agentic_guidance", "voice_out", "image_in", "image_out", "manipulatives", "draw"],
  subjects: ["science"],
  gradeBands: ["PRE_K", "K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"],
  functioningLevels: ["STANDARD", "SUPPORTED", "LOW_VERBAL", "NON_VERBAL", "PRE_SYMBOLIC"],
  skillGraphRefs: [
    "prek-science-foundations",
    "ngss-k2-physical-science",
    "ngss-science-3-8",
    "ngss-science-9-12",
  ],
  // Sprint 05: science-k-fall-2026 is the REAL hand-authored pack (5
  // activities); the previous ref pointed at the 3-activity template stub.
  defaultContentPackRefs: ["science-k-fall-2026"],
  // Honest coverage (remediation Sprint 01): a band is "authored" only when
  // ≥3 real production items back it AND a signed, non-draft skill graph
  // covers it — machine-checked by `pnpm curriculum:coverage`.
  // The NGSS item bank currently clears that bar at K, 3, 5, and 8 only;
  // every other band is honestly "scaffold" until authored
  // (docs/quality/tutor-k12-coverage-gap-plan.md).
  coverageMatrix: {
    PRE_K: "scaffold",
    K: "authored",
    "1": "scaffold",
    "2": "scaffold",
    "3": "authored",
    "4": "scaffold",
    "5": "authored",
    "6": "scaffold",
    "7": "scaffold",
    "8": "authored",
    "9": "scaffold",
    "10": "scaffold",
    "11": "scaffold",
    "12": "scaffold",
  },
  // Wave E (S8): agent loop instruments + per-level action policy.
  toolset: ["get_learner_snapshot", "get_skill_position", "get_curriculum_context", "evaluate_science_answer", "file_evidence", "propose_recommendation"],
  actionPolicy: standardActionPolicy(),
  memoryPolicy: NO_MEMORY,
  policy: {
    requiresConsent: true,
    minAgeYears: 5,
    maxSessionMinutes: 20,
    requirePiiScrubbing: true,
  },
  authoringMeta: {
    owner: "curriculum-science",
    status: "production",
    aiSvcPersonaKey: "ADDON_TUTOR_SCIENCE",
  },
});

export const SCIENCE_TUTOR_MODE_ID = "science_tutor" as const;
