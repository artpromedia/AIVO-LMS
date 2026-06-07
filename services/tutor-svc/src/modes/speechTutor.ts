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
import { defineTutor, type TutorDefinition } from "@aivo/tutor-sdk";

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
  defaultContentPackRefs: ["speech-early-fall-2026"],
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
