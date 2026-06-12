/**
 * Creative Arts K — Fall 2026 (remediation — all subjects carry REAL authored packs).
 *
 * Hand-authored, standards-aligned activities referencing real
 * `ncas-creative-arts-k2` skill-graph nodes. Coverage: 4 activities.
 */
import type { ContentPack } from "../types.js";

export const creativeArtsKFall2026: ContentPack = {
  id: "creative-arts-k-fall-2026",
  title: "Creative Arts K — Fall 2026",
  version: "1.0.0",
  schemaVersion: 1,
  subject: "creative_arts",
  gradeBand: "K",
  skillGraphRefs: ["ncas-creative-arts-k2"],
  publisher: { name: "AIVO Curriculum Team", email: "curriculum@aivo.local" },
  license: "CC-BY-4.0",
  publishedAt: "2026-09-01T00:00:00Z",
  assets: [],
  activities: [
    {
      id: "art-k-001",
      title: "Imagine first",
      skillId: "ncas.arts.k2.create.imagine",
      type: "multiple_choice",
      prompt: "Before you draw, what helps most?",
      choices: [
        { id: "a", label: "Picture your idea in your mind", correct: true },
        { id: "b", label: "Break the crayons", correct: false },
        { id: "c", label: "Hide the paper", correct: false },
      ],
      difficulty: "intro",
    },
    {
      id: "art-k-002",
      title: "Mix a color",
      skillId: "ncas.arts.k2.create.draft",
      type: "multiple_choice",
      prompt: "Mixing blue and yellow paint makes\u2026",
      choices: [
        { id: "a", label: "Green", correct: true },
        { id: "b", label: "Purple", correct: false },
        { id: "c", label: "Brown", correct: false },
      ],
      difficulty: "core",
    },
    {
      id: "art-k-003",
      title: "Make it better",
      skillId: "ncas.arts.k2.create.revise",
      type: "multiple_choice",
      prompt: "Your drawing of a cat needs whiskers. What do you do?",
      choices: [
        { id: "a", label: "Add the whiskers", correct: true },
        { id: "b", label: "Throw it away", correct: false },
        { id: "c", label: "Start crying", correct: false },
      ],
      difficulty: "core",
    },
    {
      id: "art-k-004",
      title: "Share your art",
      skillId: "ncas.arts.k2.present.share",
      type: "voice",
      prompt: "Tell me about something you made and what you like about it.",
      expectedAnswer: "i made",
      difficulty: "stretch",
    },
  ],
};
