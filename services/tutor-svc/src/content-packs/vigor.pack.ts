/**
 * Starter content pack for Vigor (Physical Education & Health, K–2).
 *
 * Anchors: `shape-pe-health-k2` skills. Vigor activates a DAPE branch
 * when the learner profile carries motor IEP signals — see
 * `services/tutor-svc/src/lib/dape.ts`.
 */
import type { ContentPack } from "@aivo/content-pack";

export const vigorStarterPack: ContentPack = {
  id: "vigor-pe-health-k2-starter",
  title: "Vigor — PE & Health K–2 Starter",
  version: "0.1.0",
  schemaVersion: 1,
  subject: "pe_health",
  gradeBand: "K",
  skillGraphRefs: ["shape-pe-health-k2"],
  publisher: { name: "AIVO Curriculum (scaffold)" },
  license: "Proprietary",
  publishedAt: "2026-04-01T00:00:00Z",
  assets: [],
  activities: [
    {
      id: "vigor.k2.locomotor.intro",
      title: "Move your body",
      skillId: "shape.k2.s1.locomotor",
      type: "narration",
      prompt: "We can move our bodies in many ways — walk, run, hop, skip, gallop. Today we'll try a few.",
      difficulty: "intro",
    },
    {
      id: "vigor.k2.locomotor.tap",
      title: "Match the movement",
      skillId: "shape.k2.s1.locomotor",
      type: "tap",
      prompt: "Tap the picture that shows 'hopping'.",
      difficulty: "core",
      choices: [
        { id: "hop", label: "🦘 Hop on one foot", correct: true },
        { id: "walk", label: "🚶 Walking", correct: false },
        { id: "sit", label: "🪑 Sitting still", correct: false },
      ],
    },
    {
      id: "vigor.k2.balance.mc",
      title: "Balance check",
      skillId: "shape.k2.s1.balance",
      type: "multiple_choice",
      prompt: "Which makes balance easier?",
      difficulty: "core",
      choices: [
        { id: "wide", label: "A wide stance with arms out", correct: true },
        { id: "narrow", label: "Standing on tiptoes with eyes closed", correct: false },
      ],
    },
    {
      id: "vigor.k2.toss.stretch",
      title: "Toss and catch",
      skillId: "shape.k2.s1.toss_catch",
      type: "draw",
      prompt: "Draw the path the ball takes when you toss it gently to a friend and they catch it.",
      difficulty: "stretch",
    },
  ],
};
