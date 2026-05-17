/**
 * Starter content pack for Forge (STEM & Engineering Design, 3–5).
 *
 * Anchors: `ngss-engineering-design-3-5` skills.
 */
import type { ContentPack } from "@aivo/content-pack";

export const forgeStarterPack: ContentPack = {
  id: "forge-engineering-3-5-starter",
  title: "Forge — Engineering Design 3–5 Starter",
  version: "0.1.0",
  schemaVersion: 1,
  subject: "stem_engineering",
  gradeBand: "3",
  skillGraphRefs: ["ngss-engineering-design-3-5"],
  publisher: { name: "AIVO Curriculum (scaffold)" },
  license: "Proprietary",
  publishedAt: "2026-04-01T00:00:00Z",
  assets: [],
  activities: [
    {
      id: "forge.3-5.define.intro",
      title: "Define the problem",
      skillId: "ngss.eng.3-5.ETS1-1",
      type: "narration",
      prompt: "Engineers start by defining the problem: what needs to be solved, who it's for, and what counts as success. Today we'll design a paper-tower challenge.",
      difficulty: "intro",
    },
    {
      id: "forge.3-5.define.mc",
      title: "Pick the criteria",
      skillId: "ngss.eng.3-5.ETS1-1",
      type: "multiple_choice",
      prompt: "Our paper tower must hold up a tennis ball for 10 seconds. Which is the SUCCESS CRITERION?",
      difficulty: "core",
      choices: [
        { id: "criterion", label: "Holds the ball for 10 seconds", correct: true },
        { id: "color", label: "Is painted blue", correct: false },
        { id: "tall", label: "Is the tallest in the room", correct: false },
      ],
    },
    {
      id: "forge.3-5.compare.tap",
      title: "Compare two designs",
      skillId: "ngss.eng.3-5.ETS1-2",
      type: "tap",
      prompt: "Two towers were tested. Tower A held the ball 12 seconds; Tower B held it 4 seconds. Which design met the criterion?",
      difficulty: "core",
      choices: [
        { id: "a", label: "Tower A", correct: true },
        { id: "b", label: "Tower B", correct: false },
      ],
    },
    {
      id: "forge.3-5.test.stretch",
      title: "Plan a fair test",
      skillId: "ngss.eng.3-5.ETS1-3.test",
      type: "draw",
      prompt: "Sketch a simple test setup with one variable changed (e.g., paper thickness) and everything else the same.",
      difficulty: "stretch",
    },
  ],
};
