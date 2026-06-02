/**
 * Math, Kindergarten — Fall 2026.
 *
 * First real authored content pack for the `nova` math tutor. Anchored
 * on CCSS-Math K skills from `@aivo/skill-graphs/seeds/ccss-math-k`.
 * Inline-SVG assets for the counting/shape items so the pack is
 * self-contained (no CDN dependency for cold-start). Real-CDN assets
 * arrive via the CMS pipeline once authoring lands.
 *
 * Coverage: 5 activities across counting, addition prep, sorting, and
 * geometry. Mirrors the K-Math first-quarter typical scope.
 */
import type { ContentPack } from "../types.js";

const APPLES_SVG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 40'><g fill='#e23'><circle cx='15' cy='20' r='12'/><circle cx='45' cy='20' r='12'/><circle cx='75' cy='20' r='12'/></g></svg>`;
const SQUARE_SVG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 60'><rect x='5' y='5' width='50' height='50' fill='#39c' stroke='#036' stroke-width='2'/></svg>`;
const TRIANGLE_SVG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 60'><polygon points='30,5 55,55 5,55' fill='#fa3' stroke='#840' stroke-width='2'/></svg>`;
const CIRCLE_SVG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 60'><circle cx='30' cy='30' r='25' fill='#9c3' stroke='#360' stroke-width='2'/></svg>`;

export const mathKFall2026: ContentPack = {
  id: "math-k-fall-2026",
  title: "Math · Kindergarten · Fall 2026",
  version: "1.0.0",
  schemaVersion: 1,
  subject: "math",
  gradeBand: "K",
  skillGraphRefs: ["ccss-math-k"],
  publisher: { name: "AIVO Curriculum Team", email: "curriculum@aivo.local" },
  license: "CC-BY-4.0",
  publishedAt: "2026-09-01T00:00:00Z",
  assets: [
    {
      id: "img-three-apples",
      kind: "inline_svg",
      src: APPLES_SVG,
      alt: "Three red apples in a row.",
    },
    { id: "img-square", kind: "inline_svg", src: SQUARE_SVG, alt: "A blue square." },
    { id: "img-triangle", kind: "inline_svg", src: TRIANGLE_SVG, alt: "An orange triangle." },
    { id: "img-circle", kind: "inline_svg", src: CIRCLE_SVG, alt: "A green circle." },
  ],
  activities: [
    {
      id: "math-k-001",
      title: "Count the apples",
      skillId: "ccss-math.K.CC.B.5",
      type: "multiple_choice",
      prompt: "How many apples do you see?",
      difficulty: "intro",
      assetRefs: ["img-three-apples"],
      choices: [
        { id: "c1", label: "2", correct: false },
        { id: "c2", label: "3", correct: true },
        { id: "c3", label: "4", correct: false },
      ],
    },
    {
      id: "math-k-002",
      title: "Which is a square?",
      skillId: "ccss-math.K.G.A.2",
      type: "tap",
      prompt: "Tap the square.",
      difficulty: "intro",
      assetRefs: ["img-square", "img-triangle", "img-circle"],
      choices: [
        { id: "sq", label: "Square", correct: true },
        { id: "tr", label: "Triangle", correct: false },
        { id: "ci", label: "Circle", correct: false },
      ],
    },
    {
      id: "math-k-003",
      title: "Count along",
      skillId: "ccss-math.K.CC.A.1",
      type: "voice",
      prompt: "Count out loud: 1, 2, 3, …",
      expectedAnswer: "one two three four five|1 2 3 4 5",
      difficulty: "intro",
    },
    {
      id: "math-k-004",
      title: "More or less",
      skillId: "ccss-math.K.CC.C.6",
      type: "multiple_choice",
      prompt: "Which group has more — 3 apples or 1 apple?",
      difficulty: "core",
      choices: [
        { id: "m3", label: "3 apples", correct: true },
        { id: "m1", label: "1 apple", correct: false },
        { id: "ms", label: "Same", correct: false },
      ],
    },
    {
      id: "math-k-005",
      title: "Sort the shapes",
      skillId: "ccss-math.K.G.B.4",
      type: "drag_drop",
      prompt: "Drag each shape to the matching bin.",
      difficulty: "core",
      assetRefs: ["img-square", "img-triangle", "img-circle"],
      choices: [
        { id: "sq", label: "Square", value: "bin-square" },
        { id: "tr", label: "Triangle", value: "bin-triangle" },
        { id: "ci", label: "Circle", value: "bin-circle" },
      ],
    },
  ],
  defaultAdaptations: {
    extraThinkingTimeMs: 5000,
    forceSubtitles: true,
  },
};
