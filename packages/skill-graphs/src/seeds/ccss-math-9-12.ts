import type { SkillGraph } from "../types.js";

/**
 * Common Core State Standards — Mathematics, High School (Grades 9–12).
 * Source: http://www.corestandards.org/Math/Content/HS (public domain).
 *
 * AI-DRAFT — anchored to real CCSS HS conceptual-category codes
 * (HSN-RN, HSA-SSE, HSA-APR, HSA-REI, HSF-IF, HSF-BF, HSF-LE, HSG-CO,
 * HSG-SRT, HSG-GMD, HSS-ID, HSS-IC). NOT YET reviewed by a credentialed
 * secondary math curriculum designer; runtime should treat skills as
 * `scaffold` quality (see `nova.coverageMatrix`) until SME sign-off.
 *
 * CCSS HS skills are organized by *conceptual category* rather than by
 * grade — a learner in any of grades 9–12 may encounter any of these
 * depending on their state's course sequence (traditional Algebra I /
 * Geometry / Algebra II vs. integrated Math I / II / III). To keep the
 * planner workable, every skill below declares its conceptual category
 * via its CCSS code and is tagged to grade 9 by default; the planner
 * uses prerequisite chains (not `gradeBand`) to advance learners.
 *
 * Prerequisites are scoped to within this graph. Anchors back into the
 * `ccss-math-1-8` graph are intentionally omitted (cross-graph refs would
 * fail validateGraph); the runtime mastery-map handles continuity across
 * graphs.
 */
export const ccssMath9To12: SkillGraph = {
  id: "ccss-math-9-12",
  title: "Mathematics — Grades 9–12 (CCSS HS, AI-draft)",
  version: "0.1.0-draft",
  source: "Common Core State Standards for Mathematics, High School conceptual categories (2010)",
  framework: "CCSS-Math",
  subject: "math",
  gradeBand: "9",
  skills: [
    // ---- Number & Quantity ----
    {
      id: "ccss-math.HSN.RN.A.1",
      title: "Rewrite expressions with rational exponents",
      description:
        "I can rewrite expressions using rational exponents and radicals interchangeably.",
      subject: "math",
      gradeBand: "9",
      frameworkRefs: [{ framework: "CCSS-Math", code: "HSN-RN.A.1" }],
      prerequisites: [],
    },

    // ---- Algebra: Seeing Structure in Expressions ----
    {
      id: "ccss-math.HSA.SSE.A.2",
      title: "Use structure to rewrite expressions",
      description:
        "I can see the structure of an expression and rewrite it to reveal new information.",
      subject: "math",
      gradeBand: "9",
      frameworkRefs: [{ framework: "CCSS-Math", code: "HSA-SSE.A.2" }],
      prerequisites: [],
    },
    {
      id: "ccss-math.HSA.SSE.B.3",
      title: "Choose forms of expressions to reveal properties",
      description:
        "I can factor a quadratic or complete the square to find a maximum, minimum, or zero.",
      subject: "math",
      gradeBand: "9",
      frameworkRefs: [{ framework: "CCSS-Math", code: "HSA-SSE.B.3" }],
      prerequisites: ["ccss-math.HSA.SSE.A.2"],
    },

    // ---- Algebra: Arithmetic with Polynomials & Rational Expressions ----
    {
      id: "ccss-math.HSA.APR.A.1",
      title: "Add, subtract, and multiply polynomials",
      description:
        "I can add, subtract, and multiply polynomials and explain that polynomials are closed under these operations.",
      subject: "math",
      gradeBand: "9",
      frameworkRefs: [{ framework: "CCSS-Math", code: "HSA-APR.A.1" }],
      prerequisites: ["ccss-math.HSA.SSE.A.2"],
    },
    {
      id: "ccss-math.HSA.APR.B.3",
      title: "Identify zeros of polynomials and graph them",
      description:
        "I can identify the zeros of a polynomial when it is factored and use them to sketch the graph.",
      subject: "math",
      gradeBand: "10",
      frameworkRefs: [{ framework: "CCSS-Math", code: "HSA-APR.B.3" }],
      prerequisites: ["ccss-math.HSA.APR.A.1", "ccss-math.HSA.SSE.B.3"],
    },

    // ---- Algebra: Reasoning with Equations & Inequalities ----
    {
      id: "ccss-math.HSA.REI.B.4",
      title: "Solve quadratic equations",
      description:
        "I can solve a quadratic equation by factoring, completing the square, or using the quadratic formula.",
      subject: "math",
      gradeBand: "9",
      frameworkRefs: [{ framework: "CCSS-Math", code: "HSA-REI.B.4" }],
      prerequisites: ["ccss-math.HSA.SSE.B.3"],
    },
    {
      id: "ccss-math.HSA.REI.C.6",
      title: "Solve systems of linear equations",
      description:
        "I can solve a system of two linear equations exactly and approximately, including graphically.",
      subject: "math",
      gradeBand: "9",
      frameworkRefs: [{ framework: "CCSS-Math", code: "HSA-REI.C.6" }],
      prerequisites: [],
    },

    // ---- Functions: Interpreting Functions ----
    {
      id: "ccss-math.HSF.IF.B.4",
      title: "Interpret key features of a function from its graph",
      description:
        "I can read intercepts, intervals of increase/decrease, maxima/minima, and end behavior from a graph.",
      subject: "math",
      gradeBand: "9",
      frameworkRefs: [{ framework: "CCSS-Math", code: "HSF-IF.B.4" }],
      prerequisites: ["ccss-math.HSA.REI.C.6"],
    },
    {
      id: "ccss-math.HSF.IF.C.7",
      title: "Graph functions and show key features",
      description:
        "I can graph linear, quadratic, exponential, and piecewise functions and label key features.",
      subject: "math",
      gradeBand: "10",
      frameworkRefs: [{ framework: "CCSS-Math", code: "HSF-IF.C.7" }],
      prerequisites: ["ccss-math.HSF.IF.B.4"],
    },

    // ---- Functions: Building & Linear/Exponential Models ----
    {
      id: "ccss-math.HSF.BF.A.1",
      title: "Build a function modeling a relationship",
      description:
        "I can write a function that describes how one quantity depends on another in a real situation.",
      subject: "math",
      gradeBand: "10",
      frameworkRefs: [{ framework: "CCSS-Math", code: "HSF-BF.A.1" }],
      prerequisites: ["ccss-math.HSF.IF.B.4"],
    },
    {
      id: "ccss-math.HSF.LE.A.1",
      title: "Distinguish linear from exponential growth",
      description:
        "I can tell whether a real situation grows by a constant amount (linear) or a constant factor (exponential).",
      subject: "math",
      gradeBand: "9",
      frameworkRefs: [{ framework: "CCSS-Math", code: "HSF-LE.A.1" }],
      prerequisites: [],
    },

    // ---- Geometry: Congruence ----
    {
      id: "ccss-math.HSG.CO.B.7",
      title: "Use congruence criteria for triangles",
      description:
        "I can decide whether two triangles are congruent using SSS, SAS, ASA, AAS, or HL.",
      subject: "math",
      gradeBand: "10",
      frameworkRefs: [{ framework: "CCSS-Math", code: "HSG-CO.B.7" }],
      prerequisites: [],
    },
    {
      id: "ccss-math.HSG.SRT.B.5",
      title: "Use similarity and congruence to solve problems",
      description:
        "I can use congruence and similarity to find missing measurements and prove geometric statements.",
      subject: "math",
      gradeBand: "10",
      frameworkRefs: [{ framework: "CCSS-Math", code: "HSG-SRT.B.5" }],
      prerequisites: ["ccss-math.HSG.CO.B.7"],
    },
    {
      id: "ccss-math.HSG.GMD.A.3",
      title: "Use volume formulas for cylinders, pyramids, cones, and spheres",
      description:
        "I can use volume formulas to solve real-world and mathematical problems.",
      subject: "math",
      gradeBand: "10",
      frameworkRefs: [{ framework: "CCSS-Math", code: "HSG-GMD.A.3" }],
      prerequisites: [],
    },

    // ---- Statistics & Probability ----
    {
      id: "ccss-math.HSS.ID.A.2",
      title: "Compare distributions of two data sets",
      description:
        "I can compare center, spread, and shape of two data sets to draw conclusions.",
      subject: "math",
      gradeBand: "11",
      frameworkRefs: [{ framework: "CCSS-Math", code: "HSS-ID.A.2" }],
      prerequisites: [],
    },
    {
      id: "ccss-math.HSS.IC.B.4",
      title: "Use sample data to estimate a population parameter",
      description:
        "I can use a sample mean or proportion to estimate a population value and describe the uncertainty.",
      subject: "math",
      gradeBand: "11",
      frameworkRefs: [{ framework: "CCSS-Math", code: "HSS-IC.B.4" }],
      prerequisites: ["ccss-math.HSS.ID.A.2"],
    },

    // ---- Pre-Calculus / capstone modeling ----
    {
      id: "ccss-math.HSF.IF.C.8",
      title: "Compare functions across representations",
      description:
        "I can compare key features of two functions presented algebraically, graphically, or in tables.",
      subject: "math",
      gradeBand: "11",
      frameworkRefs: [{ framework: "CCSS-Math", code: "HSF-IF.C.8" }],
      prerequisites: ["ccss-math.HSF.IF.C.7"],
    },
    {
      id: "ccss-math.HSA.REI.D.11",
      title: "Solve equations graphically and approximate solutions",
      description:
        "I can use a graph or table to find where two functions are equal and approximate the solution.",
      subject: "math",
      gradeBand: "12",
      frameworkRefs: [{ framework: "CCSS-Math", code: "HSA-REI.D.11" }],
      prerequisites: ["ccss-math.HSF.IF.C.7", "ccss-math.HSA.REI.B.4"],
    },
    {
      id: "ccss-math.HSF.BF.B.4",
      title: "Find and verify inverse functions",
      description:
        "I can find the inverse of a function and verify that one undoes the other.",
      subject: "math",
      gradeBand: "12",
      frameworkRefs: [{ framework: "CCSS-Math", code: "HSF-BF.B.4" }],
      prerequisites: ["ccss-math.HSF.BF.A.1"],
    },
  ],
};
