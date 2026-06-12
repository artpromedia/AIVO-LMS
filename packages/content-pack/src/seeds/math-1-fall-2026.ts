/**
 * Math — Grade 1 — Fall 2026 (remediation Sprint 08).
 *
 * Hand-authored CCSS grade-1 activities: operations & algebraic thinking,
 * base-ten, measurement, and geometry. Answer spaces are early-numeracy
 * integers wherever the skill allows so the web lesson path derives the
 * number-line surface; choices always include one correct answer.
 * Coverage: 6 activities across 5 grade-1 skills.
 */
import type { ContentPack } from "../types.js";

export const math1Fall2026: ContentPack = {
  id: "math-1-fall-2026",
  title: "Math — Grade 1 — Fall 2026",
  version: "1.0.0",
  schemaVersion: 1,
  subject: "math",
  gradeBand: "1",
  skillGraphRefs: ["ccss-math-1-8"],
  publisher: { name: "AIVO Curriculum Team", email: "curriculum@aivo.local" },
  license: "CC-BY-4.0",
  publishedAt: "2026-09-01T00:00:00Z",
  assets: [],
  activities: [
    {
      id: "math-1-001",
      title: "Word problem: add within 20",
      skillId: "ccss-math.1.OA.A.1",
      type: "multiple_choice",
      prompt: "Maya has 8 stickers. Her friend gives her 5 more. How many stickers now?",
      choices: [
        { id: "c12", label: "12", correct: false },
        { id: "c13", label: "13", correct: true },
        { id: "c14", label: "14", correct: false },
      ],
      difficulty: "intro",
      tags: ["addition", "word-problem"],
    },
    {
      id: "math-1-002",
      title: "Word problem: take from",
      skillId: "ccss-math.1.OA.A.1",
      type: "multiple_choice",
      prompt: "There are 14 birds on a wire. 6 fly away. How many birds are left?",
      choices: [
        { id: "c7", label: "7", correct: false },
        { id: "c8", label: "8", correct: true },
        { id: "c9", label: "9", correct: false },
      ],
      difficulty: "core",
      tags: ["subtraction", "word-problem"],
    },
    {
      id: "math-1-003",
      title: "Tens and ones",
      skillId: "ccss-math.1.NBT.B.2",
      type: "multiple_choice",
      prompt: "The number 47 is made of how many tens and ones?",
      choices: [
        { id: "a", label: "4 tens and 7 ones", correct: true },
        { id: "b", label: "7 tens and 4 ones", correct: false },
        { id: "c", label: "40 tens and 7 ones", correct: false },
      ],
      difficulty: "core",
      tags: ["place-value"],
    },
    {
      id: "math-1-004",
      title: "Add tens",
      skillId: "ccss-math.1.NBT.C.4",
      type: "multiple_choice",
      prompt: "What is 30 + 40?",
      choices: [
        { id: "c60", label: "60", correct: false },
        { id: "c70", label: "70", correct: true },
        { id: "c80", label: "80", correct: false },
      ],
      difficulty: "core",
      tags: ["place-value", "addition"],
    },
    {
      id: "math-1-005",
      title: "Tell time to the hour",
      skillId: "ccss-math.1.MD.B.3",
      type: "multiple_choice",
      prompt: "The little hand points at 3 and the big hand points at 12. What time is it?",
      choices: [
        { id: "a", label: "3 o'clock", correct: true },
        { id: "b", label: "12 o'clock", correct: false },
        { id: "c", label: "Half past 3", correct: false },
      ],
      difficulty: "core",
      tags: ["time"],
    },
    {
      id: "math-1-006",
      title: "Halves and quarters",
      skillId: "ccss-math.1.G.A.2",
      type: "tap",
      prompt: "A pizza is cut into 2 equal pieces. What is each piece called?",
      choices: [
        { id: "half", label: "A half", correct: true },
        { id: "quarter", label: "A quarter", correct: false },
        { id: "third", label: "A third", correct: false },
      ],
      difficulty: "stretch",
      tags: ["geometry", "fractions"],
    },
  ],
};
