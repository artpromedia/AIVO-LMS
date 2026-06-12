/**
 * Executive Function K — Fall 2026 (remediation — all subjects carry REAL authored packs).
 *
 * Hand-authored, standards-aligned activities referencing real
 * `cec-executive-function-k-12` skill-graph nodes. Coverage: 4 activities.
 */
import type { ContentPack } from "../types.js";

export const executiveFunctionKFall2026: ContentPack = {
  id: "executive-function-k-fall-2026",
  title: "Executive Function K — Fall 2026",
  version: "1.0.0",
  schemaVersion: 1,
  subject: "executive_function",
  gradeBand: "K",
  skillGraphRefs: ["cec-executive-function-k-12"],
  publisher: { name: "AIVO Curriculum Team", email: "curriculum@aivo.local" },
  license: "CC-BY-4.0",
  publishedAt: "2026-09-01T00:00:00Z",
  assets: [],
  activities: [
    {
      id: "ef-k-001",
      title: "What comes next?",
      skillId: "executive-function.K.sequence",
      type: "multiple_choice",
      prompt: "Wash hands \u2192 dry hands \u2192 ? What comes next before snack?",
      choices: [
        { id: "a", label: "Sit at the table", correct: true },
        { id: "b", label: "Put hands in paint", correct: false },
        { id: "c", label: "Go back to sleep", correct: false },
      ],
      difficulty: "intro",
    },
    {
      id: "ef-k-002",
      title: "First-then",
      skillId: "executive-function.K.sequence",
      type: "multiple_choice",
      prompt: "First we clean up, THEN we play outside. What do we do first?",
      choices: [
        { id: "a", label: "Clean up", correct: true },
        { id: "b", label: "Play outside", correct: false },
        { id: "c", label: "Watch TV", correct: false },
      ],
      difficulty: "core",
    },
    {
      id: "ef-k-003",
      title: "Pack the bag",
      skillId: "executive-function.K.sequence",
      type: "multiple_choice",
      prompt: "Which belongs in your school bag?",
      choices: [
        { id: "a", label: "Your folder", correct: true },
        { id: "b", label: "The TV remote", correct: false },
        { id: "c", label: "A pillow", correct: false },
      ],
      difficulty: "core",
    },
    {
      id: "ef-k-004",
      title: "Say your steps",
      skillId: "executive-function.K.sequence",
      type: "voice",
      prompt: "Tell me the steps you follow to wash your hands, in order.",
      expectedAnswer: "turn on the water",
      difficulty: "stretch",
    },
  ],
};
