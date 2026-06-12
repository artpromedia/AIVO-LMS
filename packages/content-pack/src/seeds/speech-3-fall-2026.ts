/**
 * Speech 3 — Fall 2026 (remediation — all subjects carry REAL authored packs).
 *
 * Hand-authored, standards-aligned activities referencing real
 * `asha-speech-school-age` skill-graph nodes. Coverage: 4 activities.
 */
import type { ContentPack } from "../types.js";

export const speech3Fall2026: ContentPack = {
  id: "speech-3-fall-2026",
  title: "Speech 3 — Fall 2026",
  version: "1.0.0",
  schemaVersion: 1,
  subject: "speech",
  gradeBand: "3",
  skillGraphRefs: ["asha-speech-school-age"],
  publisher: { name: "AIVO Curriculum Team", email: "curriculum@aivo.local" },
  license: "CC-BY-4.0",
  publishedAt: "2026-09-01T00:00:00Z",
  assets: [],
  activities: [
    {
      id: "speech-3-001",
      title: "Multisyllable words",
      skillId: "asha.school.art.multi",
      type: "voice",
      prompt: "Say this word in clear parts: \"butterfly\".",
      expectedAnswer: "butterfly",
      difficulty: "intro",
    },
    {
      id: "speech-3-002",
      title: "Word meanings",
      skillId: "asha.school.sem.word",
      type: "multiple_choice",
      prompt: "Which word means almost the same as \"happy\"?",
      choices: [
        { id: "a", label: "glad", correct: true },
        { id: "b", label: "tired", correct: false },
        { id: "c", label: "tall", correct: false },
      ],
      difficulty: "core",
    },
    {
      id: "speech-3-003",
      title: "Connected speech",
      skillId: "asha.school.art.connected",
      type: "voice",
      prompt: "Read this sentence smoothly: \"The little turtle carried his house everywhere.\"",
      expectedAnswer: "the little turtle carried his house everywhere",
      difficulty: "core",
    },
    {
      id: "speech-3-004",
      title: "Figurative language",
      skillId: "asha.school.sem.figurative",
      type: "multiple_choice",
      prompt: "\"It is raining cats and dogs\" means\u2026",
      choices: [
        { id: "a", label: "It is raining very hard", correct: true },
        { id: "b", label: "Animals are falling", correct: false },
        { id: "c", label: "It stopped raining", correct: false },
      ],
      difficulty: "stretch",
    },
  ],
};
