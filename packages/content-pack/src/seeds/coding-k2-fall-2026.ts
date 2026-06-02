/**
 * Coding, K-2 — Fall 2026.
 *
 * First real authored content pack for the `pixel` coding tutor.
 * Anchored on CSTA 1A computational-thinking skills from
 * `@aivo/skill-graphs/seeds/csta-coding-k2`. Sequencing and pattern
 * recognition come first; conditionals layer in by the end of the pack.
 */
import type { ContentPack } from "../types.js";

const ROBOT_SVG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 60'><rect x='15' y='15' width='30' height='30' rx='4' fill='#39c'/><circle cx='24' cy='25' r='3' fill='#fff'/><circle cx='36' cy='25' r='3' fill='#fff'/><rect x='22' y='35' width='16' height='3' fill='#fff'/></svg>`;
const GRID_SVG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><g fill='none' stroke='#999' stroke-width='2'><rect x='5' y='5' width='30' height='30'/><rect x='35' y='5' width='30' height='30'/><rect x='65' y='5' width='30' height='30'/><rect x='5' y='35' width='30' height='30'/><rect x='35' y='35' width='30' height='30'/><rect x='65' y='35' width='30' height='30'/><rect x='5' y='65' width='30' height='30'/><rect x='35' y='65' width='30' height='30'/><rect x='65' y='65' width='30' height='30'/></g><circle cx='20' cy='80' r='10' fill='#39c'/><polygon points='75,15 95,30 75,45' fill='#e23'/></svg>`;

export const codingK2Fall2026: ContentPack = {
  id: "coding-k2-fall-2026",
  title: "Coding · K-2 · Fall 2026",
  version: "1.0.0",
  schemaVersion: 1,
  subject: "coding",
  gradeBand: "K",
  skillGraphRefs: ["csta-coding-k2"],
  publisher: { name: "AIVO Curriculum Team", email: "curriculum@aivo.local" },
  license: "CC-BY-4.0",
  publishedAt: "2026-09-01T00:00:00Z",
  assets: [
    { id: "img-robot", kind: "inline_svg", src: ROBOT_SVG, alt: "A friendly blue robot." },
    {
      id: "img-grid",
      kind: "inline_svg",
      src: GRID_SVG,
      alt: "A 3-by-3 grid with the robot at the bottom-left and a target flag at the top-right.",
    },
  ],
  activities: [
    {
      id: "code-k2-001",
      title: "Meet your robot",
      skillId: "csta.1A.CS.1",
      type: "narration",
      prompt: "This is your robot. We will give it small instructions so it can move on the grid.",
      difficulty: "intro",
      assetRefs: ["img-robot"],
    },
    {
      id: "code-k2-002",
      title: "Move forward",
      skillId: "csta.1A.AP.10",
      type: "multiple_choice",
      prompt:
        "Your robot is on the bottom-left of the grid. The flag is at the top-right. Which first step gets you closer to the flag?",
      difficulty: "intro",
      assetRefs: ["img-grid"],
      choices: [
        { id: "u", label: "Move up", correct: true },
        { id: "d", label: "Move down", correct: false },
        { id: "l", label: "Move left", correct: false },
      ],
    },
    {
      id: "code-k2-003",
      title: "Order the steps",
      skillId: "csta.1A.AP.10",
      type: "drag_drop",
      prompt:
        "Put the steps in order so the robot reaches the flag: move up, move up, move right, move right.",
      difficulty: "core",
      choices: [
        { id: "u1", label: "move up", value: "step-1" },
        { id: "u2", label: "move up", value: "step-2" },
        { id: "r1", label: "move right", value: "step-3" },
        { id: "r2", label: "move right", value: "step-4" },
      ],
    },
    {
      id: "code-k2-004",
      title: "Shorter program",
      skillId: "csta.1A.AP.11",
      type: "multiple_choice",
      prompt: "Which is the shorter way to make the robot move 3 steps forward?",
      difficulty: "core",
      choices: [
        { id: "lp", label: "Repeat 3 times: move forward", correct: true },
        { id: "ln", label: "move forward, move forward, move forward", correct: false },
        { id: "rp", label: "Repeat 1 time: move forward", correct: false },
      ],
    },
    {
      id: "code-k2-005",
      title: "If you see a sign",
      skillId: "csta.1A.AP.14",
      type: "multiple_choice",
      prompt: "We want the robot to honk only when it sees a sign. Which block fits?",
      difficulty: "stretch",
      choices: [
        { id: "if", label: "if sees-sign then honk", correct: true },
        { id: "al", label: "always honk", correct: false },
        { id: "nv", label: "never honk", correct: false },
      ],
    },
  ],
  defaultAdaptations: {
    extraThinkingTimeMs: 6000,
    forceSubtitles: true,
  },
};
