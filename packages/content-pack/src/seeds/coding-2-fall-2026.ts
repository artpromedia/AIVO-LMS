/**
 * Coding — Grade 2 — Fall 2026 (remediation Sprint 09).
 *
 * Hand-authored CSTA 1A grade-2 computational thinking: events,
 * conditionals in plain language, decomposition, and responsible
 * technology use. Coverage: 4 activities across 4 K-2-band skills.
 */
import type { ContentPack } from "../types.js";

export const coding2Fall2026: ContentPack = {
  id: "coding-2-fall-2026",
  title: "Coding — Grade 2 — Fall 2026",
  version: "1.0.0",
  schemaVersion: 1,
  subject: "coding",
  gradeBand: "2",
  skillGraphRefs: ["csta-coding-k2"],
  publisher: { name: "AIVO Curriculum Team", email: "curriculum@aivo.local" },
  license: "CC-BY-4.0",
  publishedAt: "2026-09-01T00:00:00Z",
  assets: [],
  activities: [
    {
      id: "coding-2-001",
      title: "Events start programs",
      skillId: "csta.1A.CS.1",
      type: "multiple_choice",
      prompt: "In a game, the character jumps WHEN the space key is pressed. What is the key press called?",
      choices: [
        { id: "a", label: "An event", correct: true },
        { id: "b", label: "A loop", correct: false },
        { id: "c", label: "A bug", correct: false },
      ],
      difficulty: "intro",
      tags: ["events"],
    },
    {
      id: "coding-2-002",
      title: "If… then…",
      skillId: "csta.1A.AP.10",
      type: "multiple_choice",
      prompt: '"IF it is raining, THEN take an umbrella." When do you take the umbrella?',
      choices: [
        { id: "a", label: "Only when it rains", correct: true },
        { id: "b", label: "Every day", correct: false },
        { id: "c", label: "Never", correct: false },
      ],
      difficulty: "core",
      tags: ["conditionals"],
    },
    {
      id: "coding-2-003",
      title: "Break the problem down",
      skillId: "csta.1A.AP.8",
      type: "multiple_choice",
      prompt: "You must program a robot to make a sandwich. What is the BEST first move?",
      choices: [
        { id: "a", label: "List the small steps in order", correct: true },
        { id: "b", label: "Tell it 'make a sandwich' and hope", correct: false },
        { id: "c", label: "Skip planning", correct: false },
      ],
      difficulty: "core",
      tags: ["decomposition"],
    },
    {
      id: "coding-2-004",
      title: "Technology choices",
      skillId: "csta.1A.IC.18",
      type: "multiple_choice",
      prompt: "A classmate's password is showing on their screen. What is the responsible thing to do?",
      choices: [
        { id: "a", label: "Look away and let them know", correct: true },
        { id: "b", label: "Memorise it", correct: false },
        { id: "c", label: "Share it", correct: false },
      ],
      difficulty: "stretch",
      tags: ["digital-citizenship"],
    },
  ],
};
