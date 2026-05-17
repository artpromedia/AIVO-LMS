/**
 * Starter content pack for Pixel (Coding & Computer Science, K–2).
 *
 * Anchors: `csta-coding-k2` skills.
 */
import type { ContentPack } from "@aivo/content-pack";

export const pixelStarterPack: ContentPack = {
  id: "pixel-coding-k2-starter",
  title: "Pixel — Coding K–2 Starter",
  version: "0.1.0",
  schemaVersion: 1,
  subject: "coding",
  gradeBand: "K",
  skillGraphRefs: ["csta-coding-k2"],
  publisher: { name: "AIVO Curriculum (scaffold)" },
  license: "Proprietary",
  publishedAt: "2026-04-01T00:00:00Z",
  assets: [],
  activities: [
    {
      id: "pixel.k2.cs1.intro",
      title: "Computers follow steps",
      skillId: "csta.1A.CS.1",
      type: "narration",
      prompt: "Computers do exactly what we tell them — step by step. Today we'll write our first set of steps.",
      difficulty: "intro",
    },
    {
      id: "pixel.k2.ap8.tap",
      title: "Algorithm order",
      skillId: "csta.1A.AP.8",
      type: "tap",
      prompt: "What's the FIRST step to make a peanut butter sandwich?",
      difficulty: "core",
      choices: [
        { id: "bread", label: "Get the bread", correct: true },
        { id: "eat", label: "Take a bite", correct: false },
        { id: "spread", label: "Spread the peanut butter", correct: false },
      ],
    },
    {
      id: "pixel.k2.ap10.mc",
      title: "Find the bug",
      skillId: "csta.1A.AP.10",
      type: "multiple_choice",
      prompt: "Steps to brush teeth: (1) put toothpaste on the brush, (2) eat breakfast, (3) brush teeth. Which step doesn't belong?",
      difficulty: "core",
      choices: [
        { id: "step1", label: "Step 1: put toothpaste on the brush", correct: false },
        { id: "step2", label: "Step 2: eat breakfast", correct: true },
        { id: "step3", label: "Step 3: brush teeth", correct: false },
      ],
    },
    {
      id: "pixel.k2.ap8.stretch",
      title: "Write a tiny program",
      skillId: "csta.1A.AP.8",
      type: "draw",
      prompt: "Draw arrows to show how to move from start ★ to the goal ⛳. You can go up, down, left, or right.",
      difficulty: "stretch",
    },
  ],
};
