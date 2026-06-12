/**
 * Math — Grade 2 — Fall 2026 (remediation Sprint 08).
 *
 * Hand-authored CCSS grade-2 activities: fluency within 20, three-digit
 * place value, two-digit addition, measurement, money, and shape
 * attributes. Coverage: 6 activities across 5 grade-2 skills.
 */
import type { ContentPack } from "../types.js";

export const math2Fall2026: ContentPack = {
  id: "math-2-fall-2026",
  title: "Math — Grade 2 — Fall 2026",
  version: "1.0.0",
  schemaVersion: 1,
  subject: "math",
  gradeBand: "2",
  skillGraphRefs: ["ccss-math-1-8"],
  publisher: { name: "AIVO Curriculum Team", email: "curriculum@aivo.local" },
  license: "CC-BY-4.0",
  publishedAt: "2026-09-01T00:00:00Z",
  assets: [],
  activities: [
    {
      id: "math-2-001",
      title: "Fluency within 20",
      skillId: "ccss-math.2.OA.B.2",
      type: "multiple_choice",
      prompt: "What is 9 + 7?",
      choices: [
        { id: "c15", label: "15", correct: false },
        { id: "c16", label: "16", correct: true },
        { id: "c17", label: "17", correct: false },
      ],
      difficulty: "intro",
      tags: ["fluency", "addition"],
    },
    {
      id: "math-2-002",
      title: "Hundreds, tens, ones",
      skillId: "ccss-math.2.NBT.A.1",
      type: "multiple_choice",
      prompt: "In the number 358, what does the 5 stand for?",
      choices: [
        { id: "a", label: "5 tens (50)", correct: true },
        { id: "b", label: "5 ones (5)", correct: false },
        { id: "c", label: "5 hundreds (500)", correct: false },
      ],
      difficulty: "core",
      tags: ["place-value"],
    },
    {
      id: "math-2-003",
      title: "Add within 100",
      skillId: "ccss-math.2.NBT.B.5",
      type: "multiple_choice",
      prompt: "What is 36 + 27?",
      choices: [
        { id: "c53", label: "53", correct: false },
        { id: "c63", label: "63", correct: true },
        { id: "c73", label: "73", correct: false },
      ],
      difficulty: "core",
      tags: ["addition", "regrouping"],
    },
    {
      id: "math-2-004",
      title: "Measure in centimetres",
      skillId: "ccss-math.2.MD.A.1",
      type: "multiple_choice",
      prompt: "A crayon reaches from 0 to 9 on a centimetre ruler. How long is it?",
      choices: [
        { id: "c8", label: "8 cm", correct: false },
        { id: "c9", label: "9 cm", correct: true },
        { id: "c10", label: "10 cm", correct: false },
      ],
      difficulty: "core",
      tags: ["measurement"],
    },
    {
      id: "math-2-005",
      title: "Count coins",
      skillId: "ccss-math.2.MD.A.1",
      type: "multiple_choice",
      prompt: "You have 2 dimes and 1 nickel. How many cents is that?",
      choices: [
        { id: "c20", label: "20¢", correct: false },
        { id: "c25", label: "25¢", correct: true },
        { id: "c30", label: "30¢", correct: false },
      ],
      difficulty: "stretch",
      tags: ["money"],
    },
    {
      id: "math-2-006",
      title: "Shapes by attributes",
      skillId: "ccss-math.2.G.A.1",
      type: "tap",
      prompt: "Which shape has exactly 3 sides and 3 corners?",
      choices: [
        { id: "tri", label: "Triangle", correct: true },
        { id: "sq", label: "Square", correct: false },
        { id: "pent", label: "Pentagon", correct: false },
      ],
      difficulty: "stretch",
      tags: ["geometry"],
    },
  ],
};
