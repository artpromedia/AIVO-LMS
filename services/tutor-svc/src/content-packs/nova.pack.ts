/**
 * Starter content pack for Nova (Mathematics, Kindergarten).
 *
 * Anchors: `ccss-math-k` skills `K.CC.A.1` and `K.CC.A.3`.
 * Status: scaffold — replace with the curriculum team's pack when shipping.
 */
import type { ContentPack } from "@aivo/content-pack";

export const novaStarterPack: ContentPack = {
  id: "nova-math-k-starter",
  title: "Nova — Math K Starter",
  version: "0.1.0",
  schemaVersion: 1,
  subject: "math",
  gradeBand: "K",
  skillGraphRefs: ["ccss-math-k"],
  publisher: { name: "AIVO Curriculum (scaffold)" },
  license: "Proprietary",
  publishedAt: "2026-04-01T00:00:00Z",
  assets: [],
  activities: [
    {
      id: "nova.k.cc1.intro",
      title: "Count by ones to 10",
      skillId: "ccss-math.K.CC.A.1",
      type: "narration",
      prompt: "Let's count together! Say each number after me: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10.",
      difficulty: "intro",
      tags: ["counting"],
    },
    {
      id: "nova.k.cc3.tap",
      title: "Find the number five",
      skillId: "ccss-math.K.CC.A.3",
      type: "tap",
      prompt: "Tap the picture that shows the number 5.",
      difficulty: "core",
      choices: [
        { id: "c3", label: "3", correct: false },
        { id: "c5", label: "5", correct: true },
        { id: "c8", label: "8", correct: false },
      ],
    },
    {
      id: "nova.k.cc1.mc",
      title: "What comes after 7?",
      skillId: "ccss-math.K.CC.A.1",
      type: "multiple_choice",
      prompt: "When we count 1, 2, 3, 4, 5, 6, 7… what number comes next?",
      difficulty: "core",
      choices: [
        { id: "c6", label: "6", correct: false },
        { id: "c8", label: "8", correct: true },
        { id: "c10", label: "10", correct: false },
      ],
    },
    {
      id: "nova.k.cc3.stretch",
      title: "Count and write",
      skillId: "ccss-math.K.CC.A.3",
      type: "tap",
      prompt: "Count the dots and tap the matching number.",
      difficulty: "stretch",
      choices: [
        { id: "n7", label: "7", correct: true },
        { id: "n9", label: "9", correct: false },
      ],
    },
  ],
};
