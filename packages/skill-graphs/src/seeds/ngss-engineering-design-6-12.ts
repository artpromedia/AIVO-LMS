import type { SkillGraph } from "../types.js";

/**
 * NGSS Engineering Design — Middle School and High School (Grades 6–12).
 * Source: https://www.nextgenscience.org/ ETS1 standards (CC BY-NC-SA).
 *
 * AI-DRAFT — anchored to real NGSS ETS1 performance expectations across
 * MS-ETS1 (grades 6–8) and HS-ETS1 (grades 9–12). NOT YET reviewed by a
 * credentialed engineering / STEM educator; runtime should treat skills
 * as `scaffold` quality (see `forge.coverageMatrix`) until SME sign-off.
 *
 * Extends `ngss-engineering-design-3-5` upward through the engineering-
 * design loop (Define → Design → Optimize). Prerequisites are within
 * this graph.
 */
export const ngssEngineeringDesign6To12: SkillGraph = {
  id: "ngss-engineering-design-6-12",
  title: "STEM & Engineering Design — Grades 6–12 (NGSS ETS1, AI-draft)",
  version: "1.0.0",
  source: "Next Generation Science Standards, Engineering Design (ETS1), grades 6–12 (2013)",
  framework: "NGSS-Engineering",
  subject: "stem_engineering",
  gradeBand: "6",
  skills: [
    // ---- MS-ETS1 (grades 6–8) ----
    {
      id: "ngss.MS-ETS1-1",
      title: "Define the criteria and constraints of a design problem",
      description:
        "I can define a design problem with precision, including criteria for success and the constraints I must work within.",
      subject: "stem_engineering",
      gradeBand: "6",
      frameworkRefs: [{ framework: "NGSS-Engineering", code: "MS-ETS1-1" }],
      prerequisites: [],
    },
    {
      id: "ngss.MS-ETS1-2",
      title: "Evaluate competing design solutions",
      description:
        "I can evaluate competing design solutions using a systematic process to decide how well they meet the criteria.",
      subject: "stem_engineering",
      gradeBand: "7",
      frameworkRefs: [{ framework: "NGSS-Engineering", code: "MS-ETS1-2" }],
      prerequisites: ["ngss.MS-ETS1-1"],
    },
    {
      id: "ngss.MS-ETS1-3",
      title: "Analyze data from tests to identify best features",
      description:
        "I can analyze test data to identify the best features of several solutions and combine them into a new solution.",
      subject: "stem_engineering",
      gradeBand: "7",
      frameworkRefs: [{ framework: "NGSS-Engineering", code: "MS-ETS1-3" }],
      prerequisites: ["ngss.MS-ETS1-2"],
    },
    {
      id: "ngss.MS-ETS1-4",
      title: "Iteratively test a model and modify based on data",
      description:
        "I can use an iterative process to test a model, gather data, and modify to improve performance.",
      subject: "stem_engineering",
      gradeBand: "8",
      frameworkRefs: [{ framework: "NGSS-Engineering", code: "MS-ETS1-4" }],
      prerequisites: ["ngss.MS-ETS1-3"],
    },

    // ---- HS-ETS1 (grades 9–12) ----
    {
      id: "ngss.HS-ETS1-1.stem",
      title: "Analyze a global challenge for major problems",
      description:
        "I can analyze a major global challenge to specify qualitative and quantitative criteria and constraints.",
      subject: "stem_engineering",
      gradeBand: "9",
      frameworkRefs: [{ framework: "NGSS-Engineering", code: "HS-ETS1-1" }],
      prerequisites: ["ngss.MS-ETS1-1"],
    },
    {
      id: "ngss.HS-ETS1-2.stem",
      title: "Decompose a complex problem into solvable parts",
      description:
        "I can decompose a major global challenge into smaller, solvable engineering problems.",
      subject: "stem_engineering",
      gradeBand: "10",
      frameworkRefs: [{ framework: "NGSS-Engineering", code: "HS-ETS1-2" }],
      prerequisites: ["ngss.HS-ETS1-1.stem"],
    },
    {
      id: "ngss.HS-ETS1-3.stem",
      title: "Evaluate a solution to a complex problem",
      description:
        "I can evaluate a solution against criteria including cost, safety, reliability, aesthetics, and impact.",
      subject: "stem_engineering",
      gradeBand: "11",
      frameworkRefs: [{ framework: "NGSS-Engineering", code: "HS-ETS1-3" }],
      prerequisites: ["ngss.HS-ETS1-2.stem"],
    },
    {
      id: "ngss.HS-ETS1-4.stem",
      title: "Use a computer simulation to model a complex system",
      description:
        "I can use a computer simulation to model how a complex system responds to design changes.",
      subject: "stem_engineering",
      gradeBand: "12",
      frameworkRefs: [{ framework: "NGSS-Engineering", code: "HS-ETS1-4" }],
      prerequisites: ["ngss.HS-ETS1-3.stem", "ngss.MS-ETS1-4"],
    },

    // ---- Capstone / cross-cutting ----
    {
      id: "ngss.stem.capstone",
      title: "Carry a design project from problem to prototype",
      description:
        "I can carry a self-defined design project from defining the problem through prototyping and iteration.",
      subject: "stem_engineering",
      gradeBand: "12",
      frameworkRefs: [{ framework: "NGSS-Engineering", code: "HS-ETS1 capstone" }],
      prerequisites: ["ngss.HS-ETS1-4.stem"],
    },
  ],
};
