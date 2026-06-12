/**
 * Speech K — Fall 2026 (remediation — all subjects carry REAL authored packs).
 *
 * Hand-authored, standards-aligned activities referencing real
 * `asha-speech-early` skill-graph nodes. Coverage: 4 activities.
 */
import type { ContentPack } from "../types.js";

export const speechKFall2026: ContentPack = {
  id: "speech-k-fall-2026",
  title: "Speech K — Fall 2026",
  version: "1.0.0",
  schemaVersion: 1,
  subject: "speech",
  gradeBand: "K",
  skillGraphRefs: ["asha-speech-early"],
  publisher: { name: "AIVO Curriculum Team", email: "curriculum@aivo.local" },
  license: "CC-BY-4.0",
  publishedAt: "2026-09-01T00:00:00Z",
  assets: [],
  activities: [
    {
      id: "speech-k-001",
      title: "First sound",
      skillId: "asha.early.artic.initial",
      type: "multiple_choice",
      prompt: "Which word starts with the same sound as \"sun\"?",
      choices: [
        { id: "a", label: "sock", correct: true },
        { id: "b", label: "moon", correct: false },
        { id: "c", label: "fish", correct: false },
      ],
      difficulty: "intro",
    },
    {
      id: "speech-k-002",
      title: "Core words",
      skillId: "asha.early.vocab.core",
      type: "multiple_choice",
      prompt: "You want MORE crackers. Which word do you use?",
      choices: [
        { id: "a", label: "more", correct: true },
        { id: "b", label: "stop", correct: false },
        { id: "c", label: "blue", correct: false },
      ],
      difficulty: "core",
    },
    {
      id: "speech-k-003",
      title: "Say it clearly",
      skillId: "asha.early.artic.initial",
      type: "voice",
      prompt: "Say this word slowly and clearly: \"sun\".",
      expectedAnswer: "sun",
      difficulty: "core",
    },
    {
      id: "speech-k-004",
      title: "Take a turn",
      skillId: "asha.early.convo.turn",
      type: "multiple_choice",
      prompt: "Your friend finishes talking. What do you do next?",
      choices: [
        { id: "a", label: "Take your turn to speak", correct: true },
        { id: "b", label: "Walk away", correct: false },
        { id: "c", label: "Talk over them", correct: false },
      ],
      difficulty: "stretch",
    },
  ],
};
