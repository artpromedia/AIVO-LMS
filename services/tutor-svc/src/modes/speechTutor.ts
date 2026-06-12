/**
 * Echo — Speech & Language tutor (`@aivo/tutor-sdk` `TutorDefinition`).
 *
 * Echo overlaps Speech Buddy. Speech Buddy owns the bespoke real-time
 * audio agent core (STT, VAD, TTS, dual safety filters). Echo's
 * declarative TutorDefinition runs the *non-audio* pathways — text +
 * image + AAC scaffolds — through the generic runtime. Voice
 * capabilities are declared here so the catalog UI can route audio
 * sessions over to Speech Buddy when appropriate; the consent gate is
 * inherited from Speech Buddy when audio is engaged.
 *
 * Persona / subject-strategy: `ADDON_TUTOR_SPEECH`.
 */
import {
  defineTutor,
  NO_MEMORY,
  standardActionPolicy,
  type TutorDefinition,
} from "@aivo/tutor-sdk";

export const speechTutor: TutorDefinition = defineTutor({
  id: "echo@1.0.0",
  schemaVersion: 1,
  persona: {
    id: "echo",
    name: "Echo",
    tagline: "Every voice matters.",
    voiceStyle: "warm",
    locale: "en-US",
  },
  capabilities: ["chat", "agentic_guidance", "voice_in", "voice_out", "image_in", "aac_input", "switch_scan"],
  subjects: ["speech"],
  gradeBands: ["PRE_K", "K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"],
  functioningLevels: ["STANDARD", "SUPPORTED", "LOW_VERBAL", "NON_VERBAL", "PRE_SYMBOLIC"],
  skillGraphRefs: [
    "prek-speech-foundations",
    "asha-speech-early",
    "asha-speech-school-age",
    "asha-speech-9-12",
  ],
  defaultContentPackRefs: ["speech-k-fall-2026", "speech-3-fall-2026", "speech-6-fall-2026", "speech-9-fall-2026"],
  // Honest coverage (remediation Sprint 01): a band is "authored" only when
  // ≥3 real production items back it AND a signed, non-draft skill graph
  // covers it — machine-checked by `pnpm curriculum:coverage`.
  // The ASHA-aligned speech item bank clears that bar at K, 3, and 7 only;
  // every other band is honestly "scaffold" until authored
  // (docs/quality/tutor-k12-coverage-gap-plan.md).
  // Echo authored K-12 (owner directive 2026-06-12): every band is backed by
  // >=3 real ASHA-aligned production items (machine-checked by
  // curriculum:coverage) and the signed asha-speech early/school-age/9-12
  // graphs. PRE_K stays scaffold on the 0.1.0-draft foundations graph.
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
  },
  // Wave E (S8): agent loop instruments + per-level action policy.
  toolset: ["get_learner_snapshot", "get_skill_position", "get_curriculum_context", "score_pronunciation"],
  actionPolicy: standardActionPolicy(),
  memoryPolicy: NO_MEMORY,
  policy: {
    // Voice sessions delegate to Speech Buddy, which enforces the full
    // consent + age + safety gate. Text/AAC sessions on this tutor
    // still require caregiver consent because voice is in the
    // capability list (the SDK validator enforces this).
    requiresConsent: true,
    minAgeYears: 4,
    maxSessionMinutes: 15,
    requirePiiScrubbing: true,
  },
  authoringMeta: {
    owner: "curriculum-speech",
    status: "production",
    aiSvcPersonaKey: "ADDON_TUTOR_SPEECH",
    audioDelegate: "speech-buddy",
    subjectBrain: "speech",
  },
});

export const SPEECH_TUTOR_MODE_ID = "speech_tutor" as const;
