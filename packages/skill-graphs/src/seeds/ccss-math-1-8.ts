import type { SkillGraph } from "../types.js";

/**
 * Common Core State Standards — Mathematics, Grades 1–8.
 * Source: http://www.corestandards.org/Math/Content/ (released 2010, public domain).
 *
 * This graph completes the K-8 coverage required by
 * `scripts/curriculum-coverage-check.mjs`. The Kindergarten band is
 * already covered by `ccss-math-k.ts`; this file picks up at grade 1.
 *
 * Each grade contributes a handful of representative skills from each
 * domain (Operations & Algebraic Thinking, Number & Operations, Measurement
 * & Data, Geometry; and from grade 6 onward Ratios & Proportional
 * Relationships, Expressions & Equations, Statistics & Probability, and
 * Functions). The intent is to give brain-svc / tutor-svc a real skill
 * surface per grade so a learner enrolled at any grade band can be
 * matched to at least one skill. Deepening each grade's graph is a
 * curriculum-content sprint, not a platform one.
 *
 * Prerequisites are limited to within this graph (the K graph lives in a
 * separate `SkillGraph` so cross-graph references would fail
 * `validateGraph`).
 */
export const ccssMath1To8: SkillGraph = {
  id: "ccss-math-1-8",
  title: "Mathematics — Grades 1–8 (CCSS-aligned)",
  version: "1.0.0",
  source: "Common Core State Standards for Mathematics, Grades 1–8 (2010)",
  framework: "CCSS-Math",
  subject: "math",
  gradeBand: "1",
  skills: [
    // ---- Grade 1 ----
    {
      id: "ccss-math.1.OA.A.1",
      title: "Add and subtract within 20",
      description: "I can solve word problems by adding or subtracting numbers up to 20.",
      subject: "math",
      gradeBand: "1",
      frameworkRefs: [{ framework: "CCSS-Math", code: "1.OA.A.1" }],
      prerequisites: [],
    },
    {
      id: "ccss-math.1.NBT.B.2",
      title: "Understand place value (tens and ones)",
      description: "I can show that a two-digit number is a bundle of tens and some ones.",
      subject: "math",
      gradeBand: "1",
      frameworkRefs: [{ framework: "CCSS-Math", code: "1.NBT.B.2" }],
      prerequisites: [],
    },
    {
      id: "ccss-math.1.MD.B.3",
      title: "Tell and write time (hour and half-hour)",
      description: "I can tell time to the hour and half-hour on a clock.",
      subject: "math",
      gradeBand: "1",
      frameworkRefs: [{ framework: "CCSS-Math", code: "1.MD.B.3" }],
      prerequisites: [],
    },
    {
      id: "ccss-math.1.G.A.2",
      title: "Compose 2D shapes",
      description: "I can put shapes together to make new shapes.",
      subject: "math",
      gradeBand: "1",
      frameworkRefs: [{ framework: "CCSS-Math", code: "1.G.A.2" }],
      prerequisites: [],
    },

    // ---- Grade 2 ----
    {
      id: "ccss-math.2.OA.B.2",
      title: "Fluently add and subtract within 20",
      description: "I can quickly add or subtract any two numbers up to 20 from memory.",
      subject: "math",
      gradeBand: "2",
      frameworkRefs: [{ framework: "CCSS-Math", code: "2.OA.B.2" }],
      prerequisites: ["ccss-math.1.OA.A.1"],
    },
    {
      id: "ccss-math.2.NBT.A.1",
      title: "Place value to 1000",
      description: "I can read and write numbers up to 1000 using hundreds, tens, and ones.",
      subject: "math",
      gradeBand: "2",
      frameworkRefs: [{ framework: "CCSS-Math", code: "2.NBT.A.1" }],
      prerequisites: ["ccss-math.1.NBT.B.2"],
    },
    {
      id: "ccss-math.2.MD.A.1",
      title: "Measure lengths with tools",
      description: "I can measure the length of an object using a ruler or measuring tape.",
      subject: "math",
      gradeBand: "2",
      frameworkRefs: [{ framework: "CCSS-Math", code: "2.MD.A.1" }],
      prerequisites: [],
    },

    // ---- Grade 3 ----
    {
      id: "ccss-math.3.OA.A.1",
      title: "Interpret products of whole numbers",
      description: "I can explain what 5 × 7 means as 5 groups of 7 objects.",
      subject: "math",
      gradeBand: "3",
      frameworkRefs: [{ framework: "CCSS-Math", code: "3.OA.A.1" }],
      prerequisites: ["ccss-math.2.OA.B.2"],
    },
    {
      id: "ccss-math.3.NF.A.1",
      title: "Understand unit fractions",
      description: "I can show what 1/4 means as one part of a whole split into 4 equal parts.",
      subject: "math",
      gradeBand: "3",
      frameworkRefs: [{ framework: "CCSS-Math", code: "3.NF.A.1" }],
      prerequisites: [],
    },
    {
      id: "ccss-math.3.MD.C.7",
      title: "Find area of rectangles",
      description: "I can find the area of a rectangle by multiplying its side lengths.",
      subject: "math",
      gradeBand: "3",
      frameworkRefs: [{ framework: "CCSS-Math", code: "3.MD.C.7" }],
      prerequisites: ["ccss-math.3.OA.A.1"],
    },

    // ---- Grade 4 ----
    {
      id: "ccss-math.4.OA.A.3",
      title: "Solve multi-step word problems",
      description:
        "I can solve word problems that use more than one step, with whole-number answers.",
      subject: "math",
      gradeBand: "4",
      frameworkRefs: [{ framework: "CCSS-Math", code: "4.OA.A.3" }],
      prerequisites: ["ccss-math.3.OA.A.1"],
    },
    {
      id: "ccss-math.4.NBT.B.4",
      title: "Add and subtract multi-digit numbers",
      description: "I can add or subtract numbers with several digits using the standard algorithm.",
      subject: "math",
      gradeBand: "4",
      frameworkRefs: [{ framework: "CCSS-Math", code: "4.NBT.B.4" }],
      prerequisites: ["ccss-math.2.NBT.A.1"],
    },
    {
      id: "ccss-math.4.NF.B.3",
      title: "Add and subtract fractions with like denominators",
      description: "I can add or subtract fractions when their bottom numbers are the same.",
      subject: "math",
      gradeBand: "4",
      frameworkRefs: [{ framework: "CCSS-Math", code: "4.NF.B.3" }],
      prerequisites: ["ccss-math.3.NF.A.1"],
    },

    // ---- Grade 5 ----
    {
      id: "ccss-math.5.NBT.B.5",
      title: "Multiply multi-digit whole numbers",
      description: "I can multiply numbers with several digits using the standard algorithm.",
      subject: "math",
      gradeBand: "5",
      frameworkRefs: [{ framework: "CCSS-Math", code: "5.NBT.B.5" }],
      prerequisites: ["ccss-math.4.NBT.B.4"],
    },
    {
      id: "ccss-math.5.NF.A.1",
      title: "Add and subtract fractions with unlike denominators",
      description:
        "I can add or subtract fractions even when their bottom numbers are different.",
      subject: "math",
      gradeBand: "5",
      frameworkRefs: [{ framework: "CCSS-Math", code: "5.NF.A.1" }],
      prerequisites: ["ccss-math.4.NF.B.3"],
    },
    {
      id: "ccss-math.5.G.A.1",
      title: "Plot points on a coordinate plane",
      description: "I can plot points on a graph using ordered pairs (x, y).",
      subject: "math",
      gradeBand: "5",
      frameworkRefs: [{ framework: "CCSS-Math", code: "5.G.A.1" }],
      prerequisites: [],
    },

    // ---- Grade 6 ----
    {
      id: "ccss-math.6.RP.A.3",
      title: "Use ratio and rate reasoning",
      description:
        "I can use ratios and unit rates to solve real-world problems (recipes, prices, speeds).",
      subject: "math",
      gradeBand: "6",
      frameworkRefs: [{ framework: "CCSS-Math", code: "6.RP.A.3" }],
      prerequisites: ["ccss-math.5.NF.A.1"],
    },
    {
      id: "ccss-math.6.EE.B.5",
      title: "Solve one-variable equations",
      description: "I can find the value of x in an equation like x + 3 = 7.",
      subject: "math",
      gradeBand: "6",
      frameworkRefs: [{ framework: "CCSS-Math", code: "6.EE.B.5" }],
      prerequisites: [],
    },
    {
      id: "ccss-math.6.SP.B.5",
      title: "Summarize numerical data sets",
      description: "I can describe a data set using mean, median, mode, and range.",
      subject: "math",
      gradeBand: "6",
      frameworkRefs: [{ framework: "CCSS-Math", code: "6.SP.B.5" }],
      prerequisites: [],
    },

    // ---- Grade 7 ----
    {
      id: "ccss-math.7.NS.A.1",
      title: "Add and subtract rational numbers (incl. negatives)",
      description: "I can add or subtract positive and negative fractions and decimals.",
      subject: "math",
      gradeBand: "7",
      frameworkRefs: [{ framework: "CCSS-Math", code: "7.NS.A.1" }],
      prerequisites: ["ccss-math.5.NF.A.1"],
    },
    {
      id: "ccss-math.7.RP.A.2",
      title: "Recognize and represent proportional relationships",
      description: "I can tell whether two quantities are proportional and find the constant.",
      subject: "math",
      gradeBand: "7",
      frameworkRefs: [{ framework: "CCSS-Math", code: "7.RP.A.2" }],
      prerequisites: ["ccss-math.6.RP.A.3"],
    },
    {
      id: "ccss-math.7.G.B.6",
      title: "Solve area, surface area, and volume problems",
      description:
        "I can find the area, surface area, and volume of 2D and 3D shapes I see every day.",
      subject: "math",
      gradeBand: "7",
      frameworkRefs: [{ framework: "CCSS-Math", code: "7.G.B.6" }],
      prerequisites: ["ccss-math.3.MD.C.7"],
    },

    // ---- Grade 8 ----
    {
      id: "ccss-math.8.EE.B.5",
      title: "Graph proportional relationships",
      description:
        "I can graph a proportional relationship and read the unit rate as the slope.",
      subject: "math",
      gradeBand: "8",
      frameworkRefs: [{ framework: "CCSS-Math", code: "8.EE.B.5" }],
      prerequisites: ["ccss-math.7.RP.A.2", "ccss-math.5.G.A.1"],
    },
    {
      id: "ccss-math.8.F.A.1",
      title: "Understand functions",
      description: "I can tell whether a rule is a function (each input gives one output).",
      subject: "math",
      gradeBand: "8",
      frameworkRefs: [{ framework: "CCSS-Math", code: "8.F.A.1" }],
      prerequisites: ["ccss-math.6.EE.B.5"],
    },
    {
      id: "ccss-math.8.G.B.7",
      title: "Apply the Pythagorean theorem",
      description:
        "I can use a² + b² = c² to find a missing side length of a right triangle.",
      subject: "math",
      gradeBand: "8",
      frameworkRefs: [{ framework: "CCSS-Math", code: "8.G.B.7" }],
      prerequisites: ["ccss-math.7.G.B.6"],
    },
  ],
};
