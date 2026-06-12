/**
 * Music K — Fall 2026 (remediation — all subjects carry REAL authored packs).
 *
 * Hand-authored, standards-aligned activities referencing real
 * `ncas-music-k2` skill-graph nodes. Coverage: 4 activities.
 */
import type { ContentPack } from "../types.js";

export const musicKFall2026: ContentPack = {
  id: "music-k-fall-2026",
  title: "Music K — Fall 2026",
  version: "1.0.0",
  schemaVersion: 1,
  subject: "music",
  gradeBand: "K",
  skillGraphRefs: ["ncas-music-k2"],
  publisher: { name: "AIVO Curriculum Team", email: "curriculum@aivo.local" },
  license: "CC-BY-4.0",
  publishedAt: "2026-09-01T00:00:00Z",
  assets: [],
  activities: [
    {
      id: "music-k-001",
      title: "Steady beat",
      skillId: "ncas.music.k2.perform.steady_beat",
      type: "multiple_choice",
      prompt: "Which keeps a STEADY beat?",
      choices: [
        { id: "a", label: "Clap, clap, clap, clap \u2014 evenly", correct: true },
        { id: "b", label: "Clap\u2026 wait\u2026 clap-clap-clap", correct: false },
        { id: "c", label: "No clapping", correct: false },
      ],
      difficulty: "intro",
    },
    {
      id: "music-k-002",
      title: "Echo me",
      skillId: "ncas.music.k2.perform.echo",
      type: "multiple_choice",
      prompt: "The teacher claps: long-short-short. An ECHO is\u2026",
      choices: [
        { id: "a", label: "long-short-short", correct: true },
        { id: "b", label: "short-long", correct: false },
        { id: "c", label: "silence", correct: false },
      ],
      difficulty: "core",
    },
    {
      id: "music-k-003",
      title: "Fast or slow?",
      skillId: "ncas.music.k2.respond.fast_slow",
      type: "multiple_choice",
      prompt: "A lullaby that helps a baby sleep is usually\u2026",
      choices: [
        { id: "a", label: "Slow and soft", correct: true },
        { id: "b", label: "Fast and loud", correct: false },
        { id: "c", label: "Shouted", correct: false },
      ],
      difficulty: "core",
    },
    {
      id: "music-k-004",
      title: "Make a pattern",
      skillId: "ncas.music.k2.create.idea",
      type: "voice",
      prompt: "Clap a short pattern of your own, then say 'done'.",
      expectedAnswer: "done",
      difficulty: "stretch",
    },
  ],
};
