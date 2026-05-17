/**
 * Starter content pack for Chrono (History & Social Studies, K–2).
 *
 * Anchors: `c3-social-studies-k2` skills.
 */
import type { ContentPack } from "@aivo/content-pack";

export const chronoStarterPack: ContentPack = {
  id: "chrono-history-k2-starter",
  title: "Chrono — History K–2 Starter",
  version: "0.1.0",
  schemaVersion: 1,
  subject: "social_studies",
  gradeBand: "K",
  skillGraphRefs: ["c3-social-studies-k2"],
  publisher: { name: "AIVO Curriculum (scaffold)" },
  license: "Proprietary",
  publishedAt: "2026-04-01T00:00:00Z",
  assets: [],
  activities: [
    {
      id: "chrono.k2.q1.intro",
      title: "What is a question?",
      skillId: "c3.k2.D1.Q1",
      type: "narration",
      prompt: "Historians ask questions about the past — like 'What was school like long ago?' Today we'll be history detectives.",
      difficulty: "intro",
    },
    {
      id: "chrono.k2.his1.mc",
      title: "Long ago vs. today",
      skillId: "c3.k2.D2.His.1",
      type: "multiple_choice",
      prompt: "Which one is from long ago?",
      difficulty: "core",
      choices: [
        { id: "horse_buggy", label: "A horse and buggy", correct: true },
        { id: "smartphone", label: "A smartphone", correct: false },
        { id: "tablet", label: "A tablet computer", correct: false },
      ],
    },
    {
      id: "chrono.k2.civ1.tap",
      title: "Community helpers",
      skillId: "c3.k2.D2.Civ.1",
      type: "tap",
      prompt: "Tap the person who helps keep our streets safe.",
      difficulty: "core",
      choices: [
        { id: "officer", label: "Police officer", correct: true },
        { id: "chef", label: "Chef", correct: false },
        { id: "artist", label: "Artist", correct: false },
      ],
    },
    {
      id: "chrono.k2.q1.stretch",
      title: "Ask a history question",
      skillId: "c3.k2.D1.Q1",
      type: "voice",
      prompt: "Think of one question you'd ask someone who lived 100 years ago. Say it out loud.",
      expectedAnswer: "",
      difficulty: "stretch",
    },
  ],
};
