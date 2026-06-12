/**
 * Math item bank — production seed (Sprint 2).
 *
 * Satisfies `scripts/curriculum-coverage-check.mjs`: every required
 * subject must have ≥ 20 items in `packages/item-bank/src/**`. Each
 * item references a skillId whose substring matches `math`, so the
 * coverage scanner attributes every item to `math`.
 *
 * Items use surface types implemented by the SurfaceRouter (Sprint 1):
 * `multiple_choice`/`choice_grid` and `math_expression` only. Variants
 * are direct object literals (not built via a helper) so the audit's
 * `{ id: ... skillId: ... }` regex matches each item.
 */
import type { Item } from "./types.js";

const PUBLISHED = "2026-05-25T00:00:00Z";

export const MATH_PRODUCTION_ITEMS: readonly Item[] = [
  // ---- Kindergarten ----
  {
    id: "math.k.cc.a.1.count-10",
    skillId: "ccss-math.K.CC.A.1",
    variants: [
      {
        id: "math.k.cc.a.1.count-10@1.0.0",
        itemId: "math.k.cc.a.1.count-10",
        version: "1.0.0",
        status: "active",
        cohortWeight: 1,
        publishedAt: PUBLISHED,
        body: {
          stem: "Count out loud from 1 to 10. Type the last number you say.",
          correctAnswer: "10",
        },
        defectCount: 0,
        surfaceType: "math_expression",
      },
    ],
  },
  {
    id: "math.k.cc.b.5.count-objects",
    skillId: "ccss-math.K.CC.B.5",
    variants: [
      {
        id: "math.k.cc.b.5.count-objects@1.0.0",
        itemId: "math.k.cc.b.5.count-objects",
        version: "1.0.0",
        status: "active",
        cohortWeight: 1,
        publishedAt: PUBLISHED,
        body: { stem: "How many stars? ★★★★", choices: ["2", "3", "4", "5"], correctAnswer: "4" },
        defectCount: 0,
        surfaceType: "choice_grid",
      },
    ],
  },
  {
    id: "math.k.cc.c.6.compare-groups",
    skillId: "ccss-math.K.CC.C.6",
    variants: [
      {
        id: "math.k.cc.c.6.compare-groups@1.0.0",
        itemId: "math.k.cc.c.6.compare-groups",
        version: "1.0.0",
        status: "active",
        cohortWeight: 1,
        publishedAt: PUBLISHED,
        body: {
          stem: "Which group has more? Group A: ▲▲▲. Group B: ▲▲.",
          choices: ["A", "B", "Same"],
          correctAnswer: "A",
        },
        defectCount: 0,
        surfaceType: "choice_grid",
      },
    ],
  },
  {
    id: "math.k.g.a.1.shape-name",
    skillId: "ccss-math.K.G.A.1",
    variants: [
      {
        id: "math.k.g.a.1.shape-name@1.0.0",
        itemId: "math.k.g.a.1.shape-name",
        version: "1.0.0",
        status: "active",
        cohortWeight: 1,
        publishedAt: PUBLISHED,
        body: {
          stem: "What shape has 3 sides?",
          choices: ["Square", "Triangle", "Circle", "Rectangle"],
          correctAnswer: "Triangle",
        },
        defectCount: 0,
        surfaceType: "choice_grid",
      },
    ],
  },

  // ---- Grade 1 ----
  {
    id: "math.1.oa.a.1.add-within-20",
    skillId: "ccss-math.1.OA.A.1",
    variants: [
      {
        id: "math.1.oa.a.1.add-within-20@1.0.0",
        itemId: "math.1.oa.a.1.add-within-20",
        version: "1.0.0",
        status: "active",
        cohortWeight: 1,
        publishedAt: PUBLISHED,
        body: { stem: "8 + 5 = ?", correctAnswer: "13" },
        defectCount: 0,
        surfaceType: "math_expression",
      },
    ],
  },
  {
    id: "math.1.nbt.b.2.place-value",
    skillId: "ccss-math.1.NBT.B.2",
    variants: [
      {
        id: "math.1.nbt.b.2.place-value@1.0.0",
        itemId: "math.1.nbt.b.2.place-value",
        version: "1.0.0",
        status: "active",
        cohortWeight: 1,
        publishedAt: PUBLISHED,
        body: { stem: "The number 47 has how many tens?", correctAnswer: "4" },
        defectCount: 0,
        surfaceType: "math_expression",
      },
    ],
  },
  {
    id: "math.1.md.b.3.time-half-hour",
    skillId: "ccss-math.1.MD.B.3",
    variants: [
      {
        id: "math.1.md.b.3.time-half-hour@1.0.0",
        itemId: "math.1.md.b.3.time-half-hour",
        version: "1.0.0",
        status: "active",
        cohortWeight: 1,
        publishedAt: PUBLISHED,
        body: {
          stem: "The clock shows 3:30. Pick the matching time.",
          choices: ["3:00", "3:30", "4:00", "4:30"],
          correctAnswer: "3:30",
        },
        defectCount: 0,
        surfaceType: "choice_grid",
      },
    ],
  },

  // ---- Grade 2 ----
  {
    id: "math.2.oa.b.2.fluency-add",
    skillId: "ccss-math.2.OA.B.2",
    variants: [
      {
        id: "math.2.oa.b.2.fluency-add@1.0.0",
        itemId: "math.2.oa.b.2.fluency-add",
        version: "1.0.0",
        status: "active",
        cohortWeight: 1,
        publishedAt: PUBLISHED,
        body: { stem: "7 + 6 = ?", correctAnswer: "13" },
        defectCount: 0,
        surfaceType: "math_expression",
      },
    ],
  },
  {
    id: "math.2.nbt.a.1.hundreds",
    skillId: "ccss-math.2.NBT.A.1",
    variants: [
      {
        id: "math.2.nbt.a.1.hundreds@1.0.0",
        itemId: "math.2.nbt.a.1.hundreds",
        version: "1.0.0",
        status: "active",
        cohortWeight: 1,
        publishedAt: PUBLISHED,
        body: { stem: "The number 384 has how many hundreds?", correctAnswer: "3" },
        defectCount: 0,
        surfaceType: "math_expression",
      },
    ],
  },
  {
    id: "math.2.md.a.1.measure-length",
    skillId: "ccss-math.2.MD.A.1",
    variants: [
      {
        id: "math.2.md.a.1.measure-length@1.0.0",
        itemId: "math.2.md.a.1.measure-length",
        version: "1.0.0",
        status: "active",
        cohortWeight: 1,
        publishedAt: PUBLISHED,
        body: {
          stem: "A pencil is 18 cm long. A ruler is 30 cm. Which is longer?",
          choices: ["Pencil", "Ruler", "Same"],
          correctAnswer: "Ruler",
        },
        defectCount: 0,
        surfaceType: "choice_grid",
      },
    ],
  },

  // ---- Sprint 08: grade 1-2 depth (pack-aligned) ----
  {
    id: "math.1.oa.a.1.birds-fly-away",
    skillId: "ccss-math.1.OA.A.1",
    variants: [
      {
        id: "math.1.oa.a.1.birds-fly-away@1.0.0",
        itemId: "math.1.oa.a.1.birds-fly-away",
        version: "1.0.0",
        status: "active",
        cohortWeight: 1,
        publishedAt: PUBLISHED,
        body: { stem: "There are 14 birds. 6 fly away. How many are left?", correctAnswer: "8", choices: ["7", "8", "9"] },
        defectCount: 0,
        surfaceType: "choice_grid",
      },
    ],
  },
  {
    id: "math.1.nbt.c.4.add-tens",
    skillId: "ccss-math.1.NBT.C.4",
    variants: [
      {
        id: "math.1.nbt.c.4.add-tens@1.0.0",
        itemId: "math.1.nbt.c.4.add-tens",
        version: "1.0.0",
        status: "active",
        cohortWeight: 1,
        publishedAt: PUBLISHED,
        body: { stem: "30 + 40 = ?", correctAnswer: "70" },
        defectCount: 0,
        surfaceType: "math_expression",
      },
    ],
  },
  {
    id: "math.1.g.a.2.equal-halves",
    skillId: "ccss-math.1.G.A.2",
    variants: [
      {
        id: "math.1.g.a.2.equal-halves@1.0.0",
        itemId: "math.1.g.a.2.equal-halves",
        version: "1.0.0",
        status: "active",
        cohortWeight: 1,
        publishedAt: PUBLISHED,
        body: { stem: "A pizza is cut into 2 equal pieces. Each piece is a…", correctAnswer: "half", choices: ["half", "quarter", "third"] },
        defectCount: 0,
        surfaceType: "choice_grid",
      },
    ],
  },
  {
    id: "math.2.nbt.b.5.add-regroup",
    skillId: "ccss-math.2.NBT.B.5",
    variants: [
      {
        id: "math.2.nbt.b.5.add-regroup@1.0.0",
        itemId: "math.2.nbt.b.5.add-regroup",
        version: "1.0.0",
        status: "active",
        cohortWeight: 1,
        publishedAt: PUBLISHED,
        body: { stem: "36 + 27 = ?", correctAnswer: "63" },
        defectCount: 0,
        surfaceType: "math_expression",
      },
    ],
  },
  {
    id: "math.2.g.a.1.three-sides",
    skillId: "ccss-math.2.G.A.1",
    variants: [
      {
        id: "math.2.g.a.1.three-sides@1.0.0",
        itemId: "math.2.g.a.1.three-sides",
        version: "1.0.0",
        status: "active",
        cohortWeight: 1,
        publishedAt: PUBLISHED,
        body: { stem: "Which shape has exactly 3 sides?", correctAnswer: "triangle", choices: ["triangle", "square", "pentagon"] },
        defectCount: 0,
        surfaceType: "choice_grid",
      },
    ],
  },
  {
    id: "math.2.md.a.1.coins",
    skillId: "ccss-math.2.MD.A.1",
    variants: [
      {
        id: "math.2.md.a.1.coins@1.0.0",
        itemId: "math.2.md.a.1.coins",
        version: "1.0.0",
        status: "active",
        cohortWeight: 1,
        publishedAt: PUBLISHED,
        body: { stem: "2 dimes and 1 nickel make how many cents?", correctAnswer: "25", choices: ["20", "25", "30"] },
        defectCount: 0,
        surfaceType: "choice_grid",
      },
    ],
  },
  // ---- Grade 3 ----
  {
    id: "math.3.oa.a.1.multiply",
    skillId: "ccss-math.3.OA.A.1",
    variants: [
      {
        id: "math.3.oa.a.1.multiply@1.0.0",
        itemId: "math.3.oa.a.1.multiply",
        version: "1.0.0",
        status: "active",
        cohortWeight: 1,
        publishedAt: PUBLISHED,
        body: { stem: "5 × 7 = ?", correctAnswer: "35" },
        defectCount: 0,
        surfaceType: "math_expression",
      },
    ],
  },
  {
    id: "math.3.nf.a.1.unit-fraction",
    skillId: "ccss-math.3.NF.A.1",
    variants: [
      {
        id: "math.3.nf.a.1.unit-fraction@1.0.0",
        itemId: "math.3.nf.a.1.unit-fraction",
        version: "1.0.0",
        status: "active",
        cohortWeight: 1,
        publishedAt: PUBLISHED,
        body: {
          stem: "A pizza is cut into 4 equal slices. One slice is what fraction of the whole?",
          correctAnswer: "1/4",
        },
        defectCount: 0,
        surfaceType: "math_expression",
      },
    ],
  },
  {
    id: "math.3.md.c.7.area",
    skillId: "ccss-math.3.MD.C.7",
    variants: [
      {
        id: "math.3.md.c.7.area@1.0.0",
        itemId: "math.3.md.c.7.area",
        version: "1.0.0",
        status: "active",
        cohortWeight: 1,
        publishedAt: PUBLISHED,
        body: {
          stem: "A rug is 4 ft wide and 6 ft long. What is its area in square feet?",
          correctAnswer: "24",
        },
        defectCount: 0,
        surfaceType: "math_expression",
      },
    ],
  },

  // ---- Grade 4 ----
  {
    id: "math.4.oa.a.3.multi-step",
    skillId: "ccss-math.4.OA.A.3",
    variants: [
      {
        id: "math.4.oa.a.3.multi-step@1.0.0",
        itemId: "math.4.oa.a.3.multi-step",
        version: "1.0.0",
        status: "active",
        cohortWeight: 1,
        publishedAt: PUBLISHED,
        body: {
          stem: "Aki has 3 boxes of 12 markers. He gives away 7. How many markers does he have left?",
          correctAnswer: "29",
        },
        defectCount: 0,
        surfaceType: "math_expression",
      },
    ],
  },
  {
    id: "math.4.nbt.b.4.add-multi-digit",
    skillId: "ccss-math.4.NBT.B.4",
    variants: [
      {
        id: "math.4.nbt.b.4.add-multi-digit@1.0.0",
        itemId: "math.4.nbt.b.4.add-multi-digit",
        version: "1.0.0",
        status: "active",
        cohortWeight: 1,
        publishedAt: PUBLISHED,
        body: { stem: "356 + 478 = ?", correctAnswer: "834" },
        defectCount: 0,
        surfaceType: "math_expression",
      },
    ],
  },
  {
    id: "math.4.nf.b.3.add-fractions-like",
    skillId: "ccss-math.4.NF.B.3",
    variants: [
      {
        id: "math.4.nf.b.3.add-fractions-like@1.0.0",
        itemId: "math.4.nf.b.3.add-fractions-like",
        version: "1.0.0",
        status: "active",
        cohortWeight: 1,
        publishedAt: PUBLISHED,
        body: { stem: "2/5 + 1/5 = ?", correctAnswer: "3/5" },
        defectCount: 0,
        surfaceType: "math_expression",
      },
    ],
  },

  // ---- Grade 5 ----
  {
    id: "math.5.nbt.b.5.multiply-multi-digit",
    skillId: "ccss-math.5.NBT.B.5",
    variants: [
      {
        id: "math.5.nbt.b.5.multiply-multi-digit@1.0.0",
        itemId: "math.5.nbt.b.5.multiply-multi-digit",
        version: "1.0.0",
        status: "active",
        cohortWeight: 1,
        publishedAt: PUBLISHED,
        body: { stem: "23 × 14 = ?", correctAnswer: "322" },
        defectCount: 0,
        surfaceType: "math_expression",
      },
    ],
  },
  {
    id: "math.5.nf.a.1.add-unlike",
    skillId: "ccss-math.5.NF.A.1",
    variants: [
      {
        id: "math.5.nf.a.1.add-unlike@1.0.0",
        itemId: "math.5.nf.a.1.add-unlike",
        version: "1.0.0",
        status: "active",
        cohortWeight: 1,
        publishedAt: PUBLISHED,
        body: { stem: "1/2 + 1/3 = ?", correctAnswer: "5/6" },
        defectCount: 0,
        surfaceType: "math_expression",
      },
    ],
  },
  {
    id: "math.5.g.a.1.plot-point",
    skillId: "ccss-math.5.G.A.1",
    variants: [
      {
        id: "math.5.g.a.1.plot-point@1.0.0",
        itemId: "math.5.g.a.1.plot-point",
        version: "1.0.0",
        status: "active",
        cohortWeight: 1,
        publishedAt: PUBLISHED,
        body: { stem: "On a number line from 0 to 10, where is the point 7?", correctAnswer: "7" },
        defectCount: 0,
        surfaceType: "math_expression",
      },
    ],
  },

  // ---- Grade 6 ----
  {
    id: "math.6.rp.a.3.unit-rate",
    skillId: "ccss-math.6.RP.A.3",
    variants: [
      {
        id: "math.6.rp.a.3.unit-rate@1.0.0",
        itemId: "math.6.rp.a.3.unit-rate",
        version: "1.0.0",
        status: "active",
        cohortWeight: 1,
        publishedAt: PUBLISHED,
        body: {
          stem: "A car travels 180 miles in 3 hours. What is its speed in miles per hour?",
          correctAnswer: "60",
        },
        defectCount: 0,
        surfaceType: "math_expression",
      },
    ],
  },
  {
    id: "math.6.ee.b.5.solve-equation",
    skillId: "ccss-math.6.EE.B.5",
    variants: [
      {
        id: "math.6.ee.b.5.solve-equation@1.0.0",
        itemId: "math.6.ee.b.5.solve-equation",
        version: "1.0.0",
        status: "active",
        cohortWeight: 1,
        publishedAt: PUBLISHED,
        body: { stem: "Solve for x: x + 4 = 11", correctAnswer: "7" },
        defectCount: 0,
        surfaceType: "math_expression",
      },
    ],
  },
  {
    id: "math.6.sp.b.5.mean",
    skillId: "ccss-math.6.SP.B.5",
    variants: [
      {
        id: "math.6.sp.b.5.mean@1.0.0",
        itemId: "math.6.sp.b.5.mean",
        version: "1.0.0",
        status: "active",
        cohortWeight: 1,
        publishedAt: PUBLISHED,
        body: { stem: "What is the mean of 4, 6, 8, 10?", correctAnswer: "7" },
        defectCount: 0,
        surfaceType: "math_expression",
      },
    ],
  },

  // ---- Grade 7 ----
  {
    id: "math.7.ns.a.1.negative-add",
    skillId: "ccss-math.7.NS.A.1",
    variants: [
      {
        id: "math.7.ns.a.1.negative-add@1.0.0",
        itemId: "math.7.ns.a.1.negative-add",
        version: "1.0.0",
        status: "active",
        cohortWeight: 1,
        publishedAt: PUBLISHED,
        body: { stem: "-3 + 8 = ?", correctAnswer: "5" },
        defectCount: 0,
        surfaceType: "math_expression",
      },
    ],
  },
  {
    id: "math.7.rp.a.2.proportion",
    skillId: "ccss-math.7.RP.A.2",
    variants: [
      {
        id: "math.7.rp.a.2.proportion@1.0.0",
        itemId: "math.7.rp.a.2.proportion",
        version: "1.0.0",
        status: "active",
        cohortWeight: 1,
        publishedAt: PUBLISHED,
        body: {
          stem: "If 3 pencils cost $1.50, how much do 5 pencils cost (in dollars)?",
          correctAnswer: "2.50",
        },
        defectCount: 0,
        surfaceType: "math_expression",
      },
    ],
  },
  {
    id: "math.7.g.b.6.area",
    skillId: "ccss-math.7.G.B.6",
    variants: [
      {
        id: "math.7.g.b.6.area@1.0.0",
        itemId: "math.7.g.b.6.area",
        version: "1.0.0",
        status: "active",
        cohortWeight: 1,
        publishedAt: PUBLISHED,
        body: {
          stem: "A triangle has base 10 cm and height 6 cm. What is its area in cm²?",
          correctAnswer: "30",
        },
        defectCount: 0,
        surfaceType: "math_expression",
      },
    ],
  },

  // ---- Grade 8 ----
  {
    id: "math.8.ee.b.5.slope",
    skillId: "ccss-math.8.EE.B.5",
    variants: [
      {
        id: "math.8.ee.b.5.slope@1.0.0",
        itemId: "math.8.ee.b.5.slope",
        version: "1.0.0",
        status: "active",
        cohortWeight: 1,
        publishedAt: PUBLISHED,
        body: {
          stem: "A line passes through (0,0) and (3,9). What is its slope?",
          correctAnswer: "3",
        },
        defectCount: 0,
        surfaceType: "math_expression",
      },
    ],
  },
  {
    id: "math.8.f.a.1.function",
    skillId: "ccss-math.8.F.A.1",
    variants: [
      {
        id: "math.8.f.a.1.function@1.0.0",
        itemId: "math.8.f.a.1.function",
        version: "1.0.0",
        status: "active",
        cohortWeight: 1,
        publishedAt: PUBLISHED,
        body: {
          stem: "Is the rule 'each input has exactly one output' a function?",
          choices: ["Yes", "No"],
          correctAnswer: "Yes",
        },
        defectCount: 0,
        surfaceType: "choice_grid",
      },
    ],
  },
  {
    id: "math.8.g.b.7.pythagorean",
    skillId: "ccss-math.8.G.B.7",
    variants: [
      {
        id: "math.8.g.b.7.pythagorean@1.0.0",
        itemId: "math.8.g.b.7.pythagorean",
        version: "1.0.0",
        status: "active",
        cohortWeight: 1,
        publishedAt: PUBLISHED,
        body: {
          stem: "A right triangle has legs of 3 and 4. What is the length of its hypotenuse?",
          correctAnswer: "5",
        },
        defectCount: 0,
        surfaceType: "math_expression",
      },
    ],
  },
];
