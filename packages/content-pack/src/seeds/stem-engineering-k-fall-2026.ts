/**
 * Stem Engineering K — Fall 2026 (remediation — all subjects carry REAL authored packs).
 *
 * Hand-authored, standards-aligned activities referencing real
 * `ngss-engineering-design-k-2` skill-graph nodes. Coverage: 4 activities.
 */
import type { ContentPack } from "../types.js";

export const stemEngineeringKFall2026: ContentPack = {
  id: "stem-engineering-k-fall-2026",
  title: "Stem Engineering K — Fall 2026",
  version: "1.0.0",
  schemaVersion: 1,
  subject: "stem_engineering",
  gradeBand: "K",
  skillGraphRefs: ["ngss-engineering-design-k-2"],
  publisher: { name: "AIVO Curriculum Team", email: "curriculum@aivo.local" },
  license: "CC-BY-4.0",
  publishedAt: "2026-09-01T00:00:00Z",
  assets: [],
  activities: [
    {
      id: "eng-k-001",
      title: "What's the problem?",
      skillId: "ngss.engineering.K.ETS1",
      type: "multiple_choice",
      prompt: "The bird feeder keeps tipping over. An engineer FIRST asks\u2026",
      choices: [
        { id: "a", label: "What does the feeder need to do?", correct: true },
        { id: "b", label: "What's for lunch?", correct: false },
        { id: "c", label: "Who tipped it?", correct: false },
      ],
      difficulty: "intro",
    },
    {
      id: "eng-k-002",
      title: "Pick a material",
      skillId: "ngss.engineering.K.ETS1",
      type: "multiple_choice",
      prompt: "Which material makes the STURDIEST tower base?",
      choices: [
        { id: "a", label: "Wooden blocks", correct: true },
        { id: "b", label: "Cotton balls", correct: false },
        { id: "c", label: "Bubbles", correct: false },
      ],
      difficulty: "core",
    },
    {
      id: "eng-k-003",
      title: "Test it",
      skillId: "ngss.engineering.K.ETS1",
      type: "multiple_choice",
      prompt: "You built a bridge from blocks. How do you TEST it?",
      choices: [
        { id: "a", label: "Gently place a toy car on it", correct: true },
        { id: "b", label: "Never touch it", correct: false },
        { id: "c", label: "Hide it", correct: false },
      ],
      difficulty: "core",
    },
    {
      id: "eng-k-004",
      title: "Tell your design",
      skillId: "ngss.engineering.K.ETS1",
      type: "voice",
      prompt: "Tell me one thing you would build to help your classroom, and why.",
      expectedAnswer: "i would build",
      difficulty: "stretch",
    },
  ],
};
