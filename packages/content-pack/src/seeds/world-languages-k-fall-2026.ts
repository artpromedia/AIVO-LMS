/**
 * World Languages K — Fall 2026 (remediation — all subjects carry REAL authored packs).
 *
 * Hand-authored, standards-aligned activities referencing real
 * `actfl-world-languages-k-5` skill-graph nodes. Coverage: 4 activities.
 */
import type { ContentPack } from "../types.js";

export const worldLanguagesKFall2026: ContentPack = {
  id: "world-languages-k-fall-2026",
  title: "World Languages K — Fall 2026",
  version: "1.0.0",
  schemaVersion: 1,
  subject: "world_languages",
  gradeBand: "K",
  skillGraphRefs: ["actfl-world-languages-k-5"],
  publisher: { name: "AIVO Curriculum Team", email: "curriculum@aivo.local" },
  license: "CC-BY-4.0",
  publishedAt: "2026-09-01T00:00:00Z",
  assets: [],
  activities: [
    {
      id: "wl-k-001",
      title: "A greeting",
      skillId: "actfl.world-languages.K.communication",
      type: "multiple_choice",
      prompt: "Which word is a Spanish greeting?",
      choices: [
        { id: "a", label: "hola", correct: true },
        { id: "b", label: "libro", correct: false },
        { id: "c", label: "mesa", correct: false },
      ],
      difficulty: "intro",
    },
    {
      id: "wl-k-002",
      title: "Say hello",
      skillId: "actfl.world-languages.K.communication",
      type: "voice",
      prompt: "Say the greeting out loud: \"hola\".",
      expectedAnswer: "hola",
      difficulty: "core",
    },
    {
      id: "wl-k-003",
      title: "Goodbye",
      skillId: "actfl.world-languages.K.communication",
      type: "multiple_choice",
      prompt: "Which word means goodbye in Spanish?",
      choices: [
        { id: "a", label: "adi\u00f3s", correct: true },
        { id: "b", label: "gato", correct: false },
        { id: "c", label: "rojo", correct: false },
      ],
      difficulty: "core",
    },
    {
      id: "wl-k-004",
      title: "Please and thanks",
      skillId: "actfl.world-languages.K.communication",
      type: "multiple_choice",
      prompt: "Which word means \"thank you\" in Spanish?",
      choices: [
        { id: "a", label: "gracias", correct: true },
        { id: "b", label: "agua", correct: false },
        { id: "c", label: "uno", correct: false },
      ],
      difficulty: "stretch",
    },
  ],
};
