/**
 * Sel K — Fall 2026 (remediation — all subjects carry REAL authored packs).
 *
 * Hand-authored, standards-aligned activities referencing real
 * `casel-sel-k2` skill-graph nodes. Coverage: 4 activities.
 */
import type { ContentPack } from "../types.js";

export const selKFall2026: ContentPack = {
  id: "sel-k-fall-2026",
  title: "Sel K — Fall 2026",
  version: "1.0.0",
  schemaVersion: 1,
  subject: "sel",
  gradeBand: "K",
  skillGraphRefs: ["casel-sel-k2"],
  publisher: { name: "AIVO Curriculum Team", email: "curriculum@aivo.local" },
  license: "CC-BY-4.0",
  publishedAt: "2026-09-01T00:00:00Z",
  assets: [],
  activities: [
    {
      id: "sel-k-001",
      title: "Name the feeling",
      skillId: "casel.k2.self_awareness.feelings",
      type: "multiple_choice",
      prompt: "A child is smiling and clapping. How do they feel?",
      choices: [
        { id: "a", label: "Happy", correct: true },
        { id: "b", label: "Angry", correct: false },
        { id: "c", label: "Sleepy", correct: false },
      ],
      difficulty: "intro",
    },
    {
      id: "sel-k-002",
      title: "Calm-down choice",
      skillId: "casel.k2.self_management.calm",
      type: "multiple_choice",
      prompt: "You feel angry. Which choice helps you calm down?",
      choices: [
        { id: "a", label: "Take three slow breaths", correct: true },
        { id: "b", label: "Yell louder", correct: false },
        { id: "c", label: "Throw the toy", correct: false },
      ],
      difficulty: "core",
    },
    {
      id: "sel-k-003",
      title: "See their side",
      skillId: "casel.k2.social_awareness.perspective",
      type: "multiple_choice",
      prompt: "Your friend lost their crayon and looks sad. What might they be feeling?",
      choices: [
        { id: "a", label: "Upset", correct: true },
        { id: "b", label: "Excited", correct: false },
        { id: "c", label: "Hungry", correct: false },
      ],
      difficulty: "core",
    },
    {
      id: "sel-k-004",
      title: "Share the blocks",
      skillId: "casel.k2.relationship.share",
      type: "multiple_choice",
      prompt: "You and a classmate both want the blocks. What is a fair plan?",
      choices: [
        { id: "a", label: "Take turns building together", correct: true },
        { id: "b", label: "Grab them all", correct: false },
        { id: "c", label: "Hide them", correct: false },
      ],
      difficulty: "stretch",
    },
  ],
};
