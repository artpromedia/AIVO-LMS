/**
 * Starter content pack for Lingua (World Languages, ACTFL Novice Low).
 *
 * Anchors: `actfl-world-languages-novice-low` skills.
 */
import type { ContentPack } from "@aivo/content-pack";

export const linguaStarterPack: ContentPack = {
  id: "lingua-world-languages-nl-starter",
  title: "Lingua — World Languages Novice Low Starter",
  version: "0.1.0",
  schemaVersion: 1,
  subject: "world_languages",
  gradeBand: "6",
  skillGraphRefs: ["actfl-world-languages-novice-low"],
  publisher: { name: "AIVO Curriculum (scaffold)" },
  license: "Proprietary",
  publishedAt: "2026-04-01T00:00:00Z",
  assets: [],
  activities: [
    {
      id: "lingua.nl.greet.intro",
      title: "Say hello (Spanish)",
      skillId: "actfl.nl.com.greet",
      type: "narration",
      prompt: "In Spanish, 'hello' is 'hola'. Listen: o-la. Let's practice greeting someone.",
      difficulty: "intro",
    },
    {
      id: "lingua.nl.greet.voice",
      title: "Say 'hola'",
      skillId: "actfl.nl.com.greet",
      type: "voice",
      prompt: "Say 'hola' to greet me.",
      expectedAnswer: "hola",
      difficulty: "core",
    },
    {
      id: "lingua.nl.ask.tap",
      title: "Ask 'how are you?'",
      skillId: "actfl.nl.com.ask",
      type: "tap",
      prompt: "Which Spanish phrase means 'How are you?'",
      difficulty: "core",
      choices: [
        { id: "como_estas", label: "¿Cómo estás?", correct: true },
        { id: "buenas_noches", label: "Buenas noches", correct: false },
        { id: "gracias", label: "Gracias", correct: false },
      ],
    },
    {
      id: "lingua.nl.menu.stretch",
      title: "Read a menu word",
      skillId: "actfl.nl.interp.menu",
      type: "multiple_choice",
      prompt: "On a Spanish menu you see 'agua'. What does it mean?",
      difficulty: "stretch",
      choices: [
        { id: "water", label: "Water", correct: true },
        { id: "bread", label: "Bread", correct: false },
        { id: "fish", label: "Fish", correct: false },
      ],
    },
  ],
};
