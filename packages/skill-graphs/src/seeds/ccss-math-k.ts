import type { SkillGraph } from "../types.js";

/**
 * Common Core State Standards — Mathematics, Kindergarten.
 * Source: http://www.corestandards.org/Math/Content/K/ (released 2010, public domain).
 * Domains covered: Counting & Cardinality (CC), Operations & Algebraic Thinking (OA),
 * Number & Operations in Base Ten (NBT), Measurement & Data (MD), Geometry (G).
 *
 * Prerequisites encode pedagogical sequence — a learner who has not yet
 * shown 1:1 correspondence (CC.B.4.a) should not be routed into composing
 * teen numbers (NBT.A.1).
 */
export const ccssMathKindergarten: SkillGraph = {
  id: "ccss-math-k",
  title: "Mathematics — Kindergarten (CCSS-aligned)",
  version: "1.0.0",
  source: "Common Core State Standards for Mathematics, Kindergarten (2010)",
  framework: "CCSS-Math",
  subject: "math",
  gradeBand: "K",
  skills: [
    // Counting & Cardinality
    {
      id: "ccss-math.K.CC.A.1",
      title: "Count to 100 by ones and tens",
      description: "I can count to 100 by 1s and by 10s.",
      subject: "math",
      gradeBand: "K",
      frameworkRefs: [
        { framework: "CCSS-Math", code: "K.CC.A.1", label: "Count to 100 by ones and by tens." },
      ],
      prerequisites: [],
    },
    {
      id: "ccss-math.K.CC.A.2",
      title: "Count forward from any number",
      description: "I can start counting from any number, not just 1.",
      subject: "math",
      gradeBand: "K",
      frameworkRefs: [{ framework: "CCSS-Math", code: "K.CC.A.2" }],
      prerequisites: ["ccss-math.K.CC.A.1"],
    },
    {
      id: "ccss-math.K.CC.A.3",
      title: "Write numbers 0–20",
      description: "I can write numbers from 0 to 20 and show how many a number is.",
      subject: "math",
      gradeBand: "K",
      frameworkRefs: [{ framework: "CCSS-Math", code: "K.CC.A.3" }],
      prerequisites: ["ccss-math.K.CC.A.1"],
    },
    {
      id: "ccss-math.K.CC.B.4",
      title: "Match numbers to quantities (1:1 correspondence)",
      description: "I can match each object to one number when I count.",
      subject: "math",
      gradeBand: "K",
      frameworkRefs: [{ framework: "CCSS-Math", code: "K.CC.B.4" }],
      prerequisites: ["ccss-math.K.CC.A.1"],
    },
    {
      id: "ccss-math.K.CC.B.5",
      title: "Count up to 20 objects",
      description: "I can count how many things are in a group of up to 20.",
      subject: "math",
      gradeBand: "K",
      frameworkRefs: [{ framework: "CCSS-Math", code: "K.CC.B.5" }],
      prerequisites: ["ccss-math.K.CC.B.4"],
    },
    {
      id: "ccss-math.K.CC.C.6",
      title: "Compare groups (greater / less / equal)",
      description: "I can tell which group has more, fewer, or the same number of things.",
      subject: "math",
      gradeBand: "K",
      frameworkRefs: [{ framework: "CCSS-Math", code: "K.CC.C.6" }],
      prerequisites: ["ccss-math.K.CC.B.5"],
    },
    {
      id: "ccss-math.K.CC.C.7",
      title: "Compare written numbers 1–10",
      description: "I can compare two written numbers between 1 and 10.",
      subject: "math",
      gradeBand: "K",
      frameworkRefs: [{ framework: "CCSS-Math", code: "K.CC.C.7" }],
      prerequisites: ["ccss-math.K.CC.A.3", "ccss-math.K.CC.C.6"],
    },

    // Operations & Algebraic Thinking
    {
      id: "ccss-math.K.OA.A.1",
      title: "Show addition and subtraction with objects, drawings, fingers",
      description: "I can show adding and taking away with things I can move.",
      subject: "math",
      gradeBand: "K",
      frameworkRefs: [{ framework: "CCSS-Math", code: "K.OA.A.1" }],
      prerequisites: ["ccss-math.K.CC.B.5"],
    },
    {
      id: "ccss-math.K.OA.A.2",
      title: "Solve word problems within 10",
      description: "I can solve add and subtract story problems with numbers up to 10.",
      subject: "math",
      gradeBand: "K",
      frameworkRefs: [{ framework: "CCSS-Math", code: "K.OA.A.2" }],
      prerequisites: ["ccss-math.K.OA.A.1"],
    },
    {
      id: "ccss-math.K.OA.A.5",
      title: "Fluently add and subtract within 5",
      description: "I can quickly add and take away numbers up to 5.",
      subject: "math",
      gradeBand: "K",
      frameworkRefs: [{ framework: "CCSS-Math", code: "K.OA.A.5" }],
      prerequisites: ["ccss-math.K.OA.A.2"],
    },

    // Number & Operations in Base Ten
    {
      id: "ccss-math.K.NBT.A.1",
      title: "Compose and decompose teen numbers (11–19)",
      description: "I can show that 14 is 1 ten and 4 ones.",
      subject: "math",
      gradeBand: "K",
      frameworkRefs: [{ framework: "CCSS-Math", code: "K.NBT.A.1" }],
      prerequisites: ["ccss-math.K.CC.B.5", "ccss-math.K.OA.A.1"],
    },

    // Measurement & Data
    {
      id: "ccss-math.K.MD.A.1",
      title: "Describe measurable attributes",
      description: "I can talk about how long, how heavy, or how big things are.",
      subject: "math",
      gradeBand: "K",
      frameworkRefs: [{ framework: "CCSS-Math", code: "K.MD.A.1" }],
      prerequisites: [],
    },
    {
      id: "ccss-math.K.MD.B.3",
      title: "Sort and count categories",
      description: "I can put things into groups and count each group.",
      subject: "math",
      gradeBand: "K",
      frameworkRefs: [{ framework: "CCSS-Math", code: "K.MD.B.3" }],
      prerequisites: ["ccss-math.K.CC.B.5", "ccss-math.K.MD.A.1"],
    },

    // Geometry
    {
      id: "ccss-math.K.G.A.1",
      title: "Identify and name basic shapes",
      description: "I can name circles, squares, triangles, rectangles, and other shapes.",
      subject: "math",
      gradeBand: "K",
      frameworkRefs: [{ framework: "CCSS-Math", code: "K.G.A.1" }],
      prerequisites: [],
    },
    {
      id: "ccss-math.K.G.B.4",
      title: "Compare 2D and 3D shapes",
      description: "I can tell how shapes are alike and different (sides, corners, flat or solid).",
      subject: "math",
      gradeBand: "K",
      frameworkRefs: [{ framework: "CCSS-Math", code: "K.G.B.4" }],
      prerequisites: ["ccss-math.K.G.A.1"],
    },
    {
      id: "ccss-math.K.G.B.6",
      title: "Compose simple shapes from smaller shapes",
      description: "I can put two triangles together to make a rectangle.",
      subject: "math",
      gradeBand: "K",
      frameworkRefs: [{ framework: "CCSS-Math", code: "K.G.B.6" }],
      prerequisites: ["ccss-math.K.G.B.4"],
    },
  ],
};
