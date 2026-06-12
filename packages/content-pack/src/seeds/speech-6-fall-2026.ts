/**
 * Speech 6 — Fall 2026 (remediation — all subjects carry REAL authored packs).
 *
 * Hand-authored, standards-aligned activities referencing real
 * `asha-speech-school-age` skill-graph nodes. Coverage: 4 activities.
 */
import type { ContentPack } from "../types.js";

export const speech6Fall2026: ContentPack = {
  id: "speech-6-fall-2026",
  title: "Speech 6 — Fall 2026",
  version: "1.0.0",
  schemaVersion: 1,
  subject: "speech",
  gradeBand: "6",
  skillGraphRefs: ["asha-speech-school-age"],
  publisher: { name: "AIVO Curriculum Team", email: "curriculum@aivo.local" },
  license: "CC-BY-4.0",
  publishedAt: "2026-09-01T00:00:00Z",
  assets: [],
  activities: [
    {
      id: "speech-6-001",
      title: "Shades of meaning",
      skillId: "asha.school.sem.word",
      type: "multiple_choice",
      prompt: "Which word is the STRONGEST: \"warm\", \"hot\", or \"scorching\"?",
      choices: [
        { id: "a", label: "scorching", correct: true },
        { id: "b", label: "warm", correct: false },
        { id: "c", label: "hot", correct: false },
      ],
      difficulty: "intro",
    },
    {
      id: "speech-6-002",
      title: "Idioms in context",
      skillId: "asha.school.sem.figurative",
      type: "multiple_choice",
      prompt: "\"Break the ice\" at a new club means\u2026",
      choices: [
        { id: "a", label: "Start a friendly conversation", correct: true },
        { id: "b", label: "Crack frozen water", correct: false },
        { id: "c", label: "Leave early", correct: false },
      ],
      difficulty: "core",
    },
    {
      id: "speech-6-003",
      title: "Present an idea",
      skillId: "asha.school.art.connected",
      type: "voice",
      prompt: "In one clear sentence, tell me a club or activity you would start at school and why.",
      expectedAnswer: "i would start",
      difficulty: "core",
    },
    {
      id: "speech-6-004",
      title: "Repair the message",
      skillId: "asha.school.art.connected",
      type: "multiple_choice",
      prompt: "Your listener looks confused. What is the BEST repair?",
      choices: [
        { id: "a", label: "Say it again a different way", correct: true },
        { id: "b", label: "Repeat it louder, identically", correct: false },
        { id: "c", label: "Give up", correct: false },
      ],
      difficulty: "stretch",
    },
  ],
};
