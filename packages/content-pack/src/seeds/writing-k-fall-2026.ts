/**
 * Writing K — Fall 2026 (remediation — all subjects carry REAL authored packs).
 *
 * Hand-authored, standards-aligned activities referencing real
 * `ccss-writing-k-8` skill-graph nodes. Coverage: 4 activities.
 */
import type { ContentPack } from "../types.js";

export const writingKFall2026: ContentPack = {
  id: "writing-k-fall-2026",
  title: "Writing K — Fall 2026",
  version: "1.0.0",
  schemaVersion: 1,
  subject: "writing",
  gradeBand: "K",
  skillGraphRefs: ["ccss-writing-k-8"],
  publisher: { name: "AIVO Curriculum Team", email: "curriculum@aivo.local" },
  license: "CC-BY-4.0",
  publishedAt: "2026-09-01T00:00:00Z",
  assets: [],
  activities: [
    {
      id: "writing-k-001",
      title: "Pick the opinion sentence",
      skillId: "ccss-writing.K.W.1",
      type: "multiple_choice",
      prompt: "Which sentence tells what the writer THINKS?",
      choices: [
        { id: "a", label: "Pizza is the best lunch.", correct: true },
        { id: "b", label: "Pizza has cheese.", correct: false },
        { id: "c", label: "Lunch is at noon.", correct: false },
      ],
      difficulty: "intro",
    },
    {
      id: "writing-k-002",
      title: "Order the story",
      skillId: "ccss-writing.K.W.3",
      type: "multiple_choice",
      prompt: "A story tells: woke up, ate breakfast, went to school. What happened FIRST?",
      choices: [
        { id: "a", label: "Woke up", correct: true },
        { id: "b", label: "Went to school", correct: false },
        { id: "c", label: "Ate breakfast", correct: false },
      ],
      difficulty: "core",
    },
    {
      id: "writing-k-003",
      title: "Finish the sentence",
      skillId: "ccss-writing.K.W.3",
      type: "multiple_choice",
      prompt: "Pick the ending that finishes the story sentence: 'The puppy ran to\u2026'",
      choices: [
        { id: "a", label: "the park.", correct: true },
        { id: "b", label: "blue seven.", correct: false },
        { id: "c", label: "ran fast the.", correct: false },
      ],
      difficulty: "core",
    },
    {
      id: "writing-k-004",
      title: "Say your opinion",
      skillId: "ccss-writing.K.W.1",
      type: "voice",
      prompt: "Tell me your favorite animal and ONE reason why you like it.",
      expectedAnswer: "my favorite animal is",
      difficulty: "stretch",
    },
  ],
};
