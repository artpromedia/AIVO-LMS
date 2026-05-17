/**
 * Starter content pack for Muse (Creative Arts & Expression, K–2).
 *
 * Anchors: `ncas-creative-arts-k2` skills.
 */
import type { ContentPack } from "@aivo/content-pack";

export const museStarterPack: ContentPack = {
  id: "muse-creative-arts-k2-starter",
  title: "Muse — Creative Arts K–2 Starter",
  version: "0.1.0",
  schemaVersion: 1,
  subject: "creative_arts",
  gradeBand: "K",
  skillGraphRefs: ["ncas-creative-arts-k2"],
  publisher: { name: "AIVO Curriculum (scaffold)" },
  license: "Proprietary",
  publishedAt: "2026-04-01T00:00:00Z",
  assets: [],
  activities: [
    {
      id: "muse.k2.imagine.intro",
      title: "Imagine a story",
      skillId: "ncas.arts.k2.create.imagine",
      type: "narration",
      prompt: "Artists imagine first. Picture in your mind: a friendly dragon who collects buttons. What color is the dragon?",
      difficulty: "intro",
    },
    {
      id: "muse.k2.draft.draw",
      title: "Draw your idea",
      skillId: "ncas.arts.k2.create.draft",
      type: "draw",
      prompt: "Draw the dragon you imagined. It's a draft — no need to be perfect.",
      difficulty: "core",
    },
    {
      id: "muse.k2.imagine.voice",
      title: "Tell the story",
      skillId: "ncas.arts.k2.create.imagine",
      type: "voice",
      prompt: "Tell me one thing your dragon does in the story.",
      expectedAnswer: "",
      difficulty: "core",
    },
    {
      id: "muse.k2.revise.stretch",
      title: "Revise your draft",
      skillId: "ncas.arts.k2.create.revise",
      type: "multiple_choice",
      prompt: "Looking at your dragon drawing, what's ONE thing you could add to make the picture stronger?",
      difficulty: "stretch",
      choices: [
        { id: "details", label: "Add details like spots or a tail", correct: true },
        { id: "erase", label: "Erase the whole drawing", correct: false },
      ],
    },
  ],
};
