/**
 * Starter content pack for Spark (Science, Grades K–2 Physical Science).
 *
 * Anchors: `ngss-k2-physical-science` skills `K-PS2-1`, `K-PS3-1`.
 */
import type { ContentPack } from "@aivo/content-pack";

export const sparkStarterPack: ContentPack = {
  id: "spark-science-k2-starter",
  title: "Spark — Science K–2 Starter",
  version: "0.1.0",
  schemaVersion: 1,
  subject: "science",
  gradeBand: "K",
  skillGraphRefs: ["ngss-k2-physical-science"],
  publisher: { name: "AIVO Curriculum (scaffold)" },
  license: "Proprietary",
  publishedAt: "2026-04-01T00:00:00Z",
  assets: [],
  activities: [
    {
      id: "spark.k.ps2.intro",
      title: "Push and pull",
      skillId: "ngss.K-PS2-1",
      type: "narration",
      prompt:
        "Forces are pushes and pulls. When you push a swing, it moves away. When you pull a wagon, it comes closer. Let's explore!",
      difficulty: "intro",
    },
    {
      id: "spark.k.ps2.tap",
      title: "Push or pull?",
      skillId: "ngss.K-PS2-1",
      type: "tap",
      prompt:
        "Look at the picture: a child opening a door by turning a knob. Is that a push or a pull?",
      difficulty: "core",
      choices: [
        { id: "push", label: "Push", correct: false },
        { id: "pull", label: "Pull", correct: true },
      ],
    },
    {
      id: "spark.k.ps3.mc",
      title: "Sunshine warms us",
      skillId: "ngss.K-PS3-1",
      type: "multiple_choice",
      prompt: "Which place feels warmer on a sunny day?",
      difficulty: "core",
      choices: [
        { id: "shade", label: "Under a tree in the shade", correct: false },
        { id: "sun", label: "On the sidewalk in the sun", correct: true },
        { id: "indoors", label: "Inside the freezer", correct: false },
      ],
    },
    {
      id: "spark.k.ps2.stretch",
      title: "Predict the motion",
      skillId: "ngss.K-PS2-1",
      type: "multiple_choice",
      prompt: "If you push a ball harder, what happens?",
      difficulty: "stretch",
      choices: [
        { id: "fast", label: "It rolls farther and faster", correct: true },
        { id: "slow", label: "It rolls slower", correct: false },
        { id: "stop", label: "It stops moving", correct: false },
      ],
    },
  ],
};
