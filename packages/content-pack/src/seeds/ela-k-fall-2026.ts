/**
 * ELA, Kindergarten — Fall 2026.
 *
 * First real authored content pack for the `sage` ELA tutor. Anchored
 * on CCSS-ELA K skills from `@aivo/skill-graphs/seeds/ccss-ela-k`.
 * Voice items for letter sounds; multiple-choice for sight-word recall.
 */
import type { ContentPack } from "../types.js";

const LETTER_A_SVG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 60'><text x='30' y='48' text-anchor='middle' font-size='52' font-family='sans-serif' fill='#246'>A</text></svg>`;
const LETTER_S_SVG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 60'><text x='30' y='48' text-anchor='middle' font-size='52' font-family='sans-serif' fill='#246'>S</text></svg>`;

export const elaKFall2026: ContentPack = {
  id: "ela-k-fall-2026",
  title: "ELA · Kindergarten · Fall 2026",
  version: "1.0.0",
  schemaVersion: 1,
  subject: "ela",
  gradeBand: "K",
  skillGraphRefs: ["ccss-ela-k"],
  publisher: { name: "AIVO Curriculum Team", email: "curriculum@aivo.local" },
  license: "CC-BY-4.0",
  publishedAt: "2026-09-01T00:00:00Z",
  assets: [
    { id: "img-letter-a", kind: "inline_svg", src: LETTER_A_SVG, alt: "The letter A." },
    { id: "img-letter-s", kind: "inline_svg", src: LETTER_S_SVG, alt: "The letter S." },
  ],
  activities: [
    {
      id: "ela-k-001",
      title: "Say the letter sound",
      skillId: "ccss-ela.K.RF.3",
      type: "voice",
      prompt: "What sound does this letter make?",
      expectedAnswer: "ah|a",
      difficulty: "intro",
      assetRefs: ["img-letter-a"],
    },
    {
      id: "ela-k-002",
      title: "Recognize the letter",
      skillId: "ccss-ela.K.RF.1",
      type: "tap",
      prompt: "Tap the letter A.",
      difficulty: "intro",
      assetRefs: ["img-letter-a", "img-letter-s"],
      choices: [
        { id: "a", label: "A", correct: true },
        { id: "s", label: "S", correct: false },
      ],
    },
    {
      id: "ela-k-003",
      title: "Rhyme time",
      skillId: "ccss-ela.K.RF.2",
      type: "multiple_choice",
      prompt: "Which word rhymes with 'cat'?",
      difficulty: "core",
      choices: [
        { id: "ht", label: "hat", correct: true },
        { id: "dg", label: "dog", correct: false },
        { id: "bl", label: "ball", correct: false },
      ],
    },
    {
      id: "ela-k-004",
      title: "Tell the story",
      skillId: "ccss-ela.K.RL.1",
      type: "voice",
      prompt: "Tell me what happened in the story we just read.",
      expectedAnswer: "*",
      difficulty: "core",
    },
    {
      id: "ela-k-005",
      title: "Picture me writing",
      skillId: "ccss-ela.K.W.1",
      type: "draw",
      prompt: "Draw a picture about your favorite animal.",
      difficulty: "core",
    },
  ],
  defaultAdaptations: {
    extraThinkingTimeMs: 5000,
    forceSubtitles: true,
  },
};
