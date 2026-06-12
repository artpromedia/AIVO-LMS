/**
 * Speech 9 — Fall 2026 (remediation — all subjects carry REAL authored packs).
 *
 * Hand-authored, standards-aligned activities referencing real
 * `asha-speech-9-12` skill-graph nodes. Coverage: 4 activities.
 */
import type { ContentPack } from "../types.js";

export const speech9Fall2026: ContentPack = {
  id: "speech-9-fall-2026",
  title: "Speech 9 — Fall 2026",
  version: "1.0.0",
  schemaVersion: 1,
  subject: "speech",
  gradeBand: "9",
  skillGraphRefs: ["asha-speech-9-12"],
  publisher: { name: "AIVO Curriculum Team", email: "curriculum@aivo.local" },
  license: "CC-BY-4.0",
  publishedAt: "2026-09-01T00:00:00Z",
  assets: [],
  activities: [
    {
      id: "speech-9-001",
      title: "Match the audience",
      skillId: "asha.speech.9.audience",
      type: "multiple_choice",
      prompt: "You are explaining a project to the principal. Which opening fits?",
      choices: [
        { id: "a", label: "Good morning \u2014 I'd like to walk you through our project.", correct: true },
        { id: "b", label: "Yo, check this out.", correct: false },
        { id: "c", label: "Whatever, here it is.", correct: false },
      ],
      difficulty: "intro",
    },
    {
      id: "speech-9-002",
      title: "Organize the talk",
      skillId: "asha.speech.10.discourse",
      type: "multiple_choice",
      prompt: "The CLEAREST order for a short presentation is\u2026",
      choices: [
        { id: "a", label: "Main idea \u2192 supporting points \u2192 conclusion", correct: true },
        { id: "b", label: "Conclusion \u2192 jokes \u2192 main idea", correct: false },
        { id: "c", label: "Random facts", correct: false },
      ],
      difficulty: "core",
    },
    {
      id: "speech-9-003",
      title: "Deliver an opening",
      skillId: "asha.speech.9.audience",
      type: "voice",
      prompt: "Record the first sentence of a presentation about a goal you have this year.",
      expectedAnswer: "this year my goal is",
      difficulty: "core",
    },
    {
      id: "speech-9-004",
      title: "Self-advocacy",
      skillId: "asha.speech.11.self-advocacy",
      type: "multiple_choice",
      prompt: "Class discussions move too fast for you. What is an effective self-advocacy step?",
      choices: [
        { id: "a", label: "Ask the teacher for a moment to gather your thoughts", correct: true },
        { id: "b", label: "Stay silent all term", correct: false },
        { id: "c", label: "Skip the class", correct: false },
      ],
      difficulty: "stretch",
    },
  ],
};
