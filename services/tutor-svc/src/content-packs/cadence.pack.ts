/**
 * Starter content pack for Cadence (Music & Rhythm, K–2).
 *
 * Anchors: `ncas-music-k2` skills.
 */
import type { ContentPack } from "@aivo/content-pack";

export const cadenceStarterPack: ContentPack = {
  id: "cadence-music-k2-starter",
  title: "Cadence — Music K–2 Starter",
  version: "0.1.0",
  schemaVersion: 1,
  subject: "music",
  gradeBand: "K",
  skillGraphRefs: ["ncas-music-k2"],
  publisher: { name: "AIVO Curriculum (scaffold)" },
  license: "Proprietary",
  publishedAt: "2026-04-01T00:00:00Z",
  assets: [],
  activities: [
    {
      id: "cadence.k2.idea.intro",
      title: "Make a rhythm idea",
      skillId: "ncas.music.k2.create.idea",
      type: "narration",
      prompt: "Music starts with an idea — a clap, a stomp, or a hum. Today we'll invent a rhythm together.",
      difficulty: "intro",
    },
    {
      id: "cadence.k2.beat.tap",
      title: "Steady beat",
      skillId: "ncas.music.k2.perform.steady_beat",
      type: "tap",
      prompt: "Tap along with the steady beat — once for every drum sound you hear.",
      difficulty: "core",
      choices: [
        { id: "tap", label: "Tap to the beat", correct: true },
      ],
    },
    {
      id: "cadence.k2.echo.voice",
      title: "Echo me",
      skillId: "ncas.music.k2.perform.echo",
      type: "voice",
      prompt: "I'll clap a short pattern: clap-clap-pause-clap. Now you echo it back.",
      expectedAnswer: "",
      difficulty: "core",
    },
    {
      id: "cadence.k2.idea.stretch",
      title: "Compose 4 beats",
      skillId: "ncas.music.k2.create.idea",
      type: "draw",
      prompt: "Draw 4 boxes. Mark each box with a clap (👏) or a rest (—) to make your own 4-beat pattern.",
      difficulty: "stretch",
    },
  ],
};
