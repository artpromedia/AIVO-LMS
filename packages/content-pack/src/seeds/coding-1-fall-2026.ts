/**
 * Coding — Grade 1 — Fall 2026 (remediation Sprint 09).
 *
 * Hand-authored CSTA 1A grade-1 computational thinking: precise
 * sequencing, loops as repetition, and debugging by checking steps.
 * Coverage: 4 activities across 3 K-2-band skills.
 */
import type { ContentPack } from "../types.js";

export const coding1Fall2026: ContentPack = {
  id: "coding-1-fall-2026",
  title: "Coding — Grade 1 — Fall 2026",
  version: "1.0.0",
  schemaVersion: 1,
  subject: "coding",
  gradeBand: "1",
  skillGraphRefs: ["csta-coding-k2"],
  publisher: { name: "AIVO Curriculum Team", email: "curriculum@aivo.local" },
  license: "CC-BY-4.0",
  publishedAt: "2026-09-01T00:00:00Z",
  assets: [],
  activities: [
    {
      id: "coding-1-001",
      title: "Order the steps",
      skillId: "csta.1A.AP.8",
      type: "multiple_choice",
      prompt: "A robot must make toast: ① press the lever ② put bread in ③ take toast out. What is the CORRECT order?",
      choices: [
        { id: "a", label: "② then ① then ③", correct: true },
        { id: "b", label: "① then ② then ③", correct: false },
        { id: "c", label: "③ then ② then ①", correct: false },
      ],
      difficulty: "intro",
      tags: ["sequencing"],
    },
    {
      id: "coding-1-002",
      title: "Spot the loop",
      skillId: "csta.1A.AP.10",
      type: "multiple_choice",
      prompt: 'The robot claps 5 times. Which instruction does the SAME job with a loop?',
      choices: [
        { id: "a", label: "Repeat 5 times: clap", correct: true },
        { id: "b", label: "Clap once", correct: false },
        { id: "c", label: "Repeat 2 times: clap", correct: false },
      ],
      difficulty: "core",
      tags: ["loops"],
    },
    {
      id: "coding-1-003",
      title: "Find the bug",
      skillId: "csta.1A.AP.14",
      type: "multiple_choice",
      prompt:
        "The robot should draw a square but drew a triangle. Its program says: repeat 3 times (draw side, turn). What should you change?",
      choices: [
        { id: "a", label: "Repeat 4 times instead of 3", correct: true },
        { id: "b", label: "Draw faster", correct: false },
        { id: "c", label: "Turn the robot off", correct: false },
      ],
      difficulty: "core",
      tags: ["debugging"],
    },
    {
      id: "coding-1-004",
      title: "Explain your algorithm",
      skillId: "csta.1A.AP.8",
      type: "voice",
      prompt: "Tell me the steps to brush your teeth, in order, like a program.",
      expectedAnswer: "get toothbrush|put on toothpaste|brush|rinse",
      difficulty: "stretch",
      tags: ["algorithms", "voice"],
    },
  ],
};
