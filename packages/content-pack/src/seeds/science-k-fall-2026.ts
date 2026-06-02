/**
 * Science, Kindergarten — Fall 2026.
 *
 * First real authored content pack for the `spark` science tutor.
 * Anchored on NGSS K physical-science skills from
 * `@aivo/skill-graphs/seeds/ngss-k2-physical-science`. Push-pull and
 * temperature-change observations are the K anchors.
 */
import type { ContentPack } from "../types.js";

const PUSH_SVG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 40'><rect x='10' y='15' width='30' height='15' fill='#7a5'/><polygon points='40,12 55,22 40,32' fill='#444'/></svg>`;
const PULL_SVG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 40'><rect x='40' y='15' width='30' height='15' fill='#7a5'/><polygon points='40,12 25,22 40,32' fill='#444'/></svg>`;
const SUN_SVG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 60'><circle cx='30' cy='30' r='15' fill='#fc3'/><g stroke='#fc3' stroke-width='3'><line x1='30' y1='5' x2='30' y2='15'/><line x1='30' y1='45' x2='30' y2='55'/><line x1='5' y1='30' x2='15' y2='30'/><line x1='45' y1='30' x2='55' y2='30'/></g></svg>`;

export const scienceKFall2026: ContentPack = {
  id: "science-k-fall-2026",
  title: "Science · Kindergarten · Fall 2026",
  version: "1.0.0",
  schemaVersion: 1,
  subject: "science",
  gradeBand: "K",
  skillGraphRefs: ["ngss-k2-physical-science"],
  publisher: { name: "AIVO Curriculum Team", email: "curriculum@aivo.local" },
  license: "CC-BY-4.0",
  publishedAt: "2026-09-01T00:00:00Z",
  assets: [
    {
      id: "img-push",
      kind: "inline_svg",
      src: PUSH_SVG,
      alt: "A hand pushing a box from the left.",
    },
    {
      id: "img-pull",
      kind: "inline_svg",
      src: PULL_SVG,
      alt: "A hand pulling a box from the right.",
    },
    { id: "img-sun", kind: "inline_svg", src: SUN_SVG, alt: "A bright yellow sun." },
  ],
  activities: [
    {
      id: "sci-k-001",
      title: "Push or pull?",
      skillId: "ngss.K-PS2-1",
      type: "multiple_choice",
      prompt: "Look at the picture. Is the hand pushing or pulling the box?",
      difficulty: "intro",
      assetRefs: ["img-push"],
      choices: [
        { id: "ps", label: "Pushing", correct: true },
        { id: "pl", label: "Pulling", correct: false },
      ],
    },
    {
      id: "sci-k-002",
      title: "Match the action",
      skillId: "ngss.K-PS2-1",
      type: "match",
      prompt: "Match each picture to the word.",
      difficulty: "core",
      assetRefs: ["img-push", "img-pull"],
      choices: [
        { id: "p1", label: "Push picture", value: "push" },
        { id: "p2", label: "Pull picture", value: "pull" },
      ],
    },
    {
      id: "sci-k-003",
      title: "Warm or cool?",
      skillId: "ngss.K-PS3-1",
      type: "multiple_choice",
      prompt: "What does the sun do to things on a hot day?",
      difficulty: "intro",
      assetRefs: ["img-sun"],
      choices: [
        { id: "wm", label: "Makes them warmer", correct: true },
        { id: "cl", label: "Makes them cooler", correct: false },
      ],
    },
    {
      id: "sci-k-004",
      title: "Stronger push",
      skillId: "ngss.K-PS2-2",
      type: "multiple_choice",
      prompt:
        "If a small ball and a big rock are next to you, which one needs a stronger push to move?",
      difficulty: "core",
      choices: [
        { id: "br", label: "Big rock", correct: true },
        { id: "sb", label: "Small ball", correct: false },
        { id: "sm", label: "Same push", correct: false },
      ],
    },
    {
      id: "sci-k-005",
      title: "Shade it",
      skillId: "ngss.K-PS3-2",
      type: "draw",
      prompt: "Draw something that could keep you cool from the sun.",
      difficulty: "core",
    },
  ],
  defaultAdaptations: {
    extraThinkingTimeMs: 5000,
    forceSubtitles: true,
  },
};
