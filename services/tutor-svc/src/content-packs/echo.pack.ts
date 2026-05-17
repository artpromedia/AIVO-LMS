/**
 * Starter content pack for Echo (Speech & Language, early childhood).
 *
 * Echo overlaps Speech Buddy and is voice-gated; this starter pack
 * supplies text-shaped scaffolding the runtime can plan around when
 * a session is *not* running through the Speech Buddy live audio loop.
 *
 * Anchors: `asha-speech-early` skills.
 */
import type { ContentPack } from "@aivo/content-pack";

export const echoStarterPack: ContentPack = {
  id: "echo-speech-early-starter",
  title: "Echo — Speech & Language Early Starter",
  version: "0.1.0",
  schemaVersion: 1,
  subject: "speech",
  gradeBand: "PRE_K",
  skillGraphRefs: ["asha-speech-early"],
  publisher: { name: "AIVO Curriculum (scaffold)" },
  license: "Proprietary",
  publishedAt: "2026-04-01T00:00:00Z",
  assets: [],
  activities: [
    {
      id: "echo.early.artic.intro",
      title: "Listen to the sound",
      skillId: "asha.early.artic.initial",
      type: "narration",
      prompt: "Listen carefully: 'sssssun'. Can you hear the /s/ sound at the start?",
      difficulty: "intro",
    },
    {
      id: "echo.early.artic.voice",
      title: "Say it with me",
      skillId: "asha.early.artic.initial",
      type: "voice",
      prompt: "Say the word 'sun' after me.",
      expectedAnswer: "sun",
      difficulty: "core",
    },
    {
      id: "echo.early.vocab.tap",
      title: "Find the apple",
      skillId: "asha.early.vocab.core",
      type: "tap",
      prompt: "Tap the picture of the apple.",
      difficulty: "core",
      choices: [
        { id: "apple", label: "Apple", correct: true },
        { id: "ball", label: "Ball", correct: false },
        { id: "cup", label: "Cup", correct: false },
      ],
    },
    {
      id: "echo.early.aac.request",
      title: "Ask for help",
      skillId: "asha.early.aac.request",
      type: "voice",
      prompt: "Use your voice or your AAC device to ask: 'help me, please'.",
      expectedAnswer: "help me|help|please help",
      difficulty: "stretch",
    },
  ],
};
