import type { SkillGraph } from "../types.js";

/**
 * Next Generation Science Standards — High School (Grades 9–12).
 * Source: https://www.nextgenscience.org/ (NGSS Lead States 2013, CC BY-NC-SA).
 *
 * AI-DRAFT — anchored to real NGSS HS performance-expectation codes
 * across the four NGSS domains: Physical Sciences (HS-PS), Life Sciences
 * (HS-LS), Earth & Space Sciences (HS-ESS), and Engineering Design
 * (HS-ETS). NOT YET reviewed by a credentialed secondary science
 * curriculum designer; runtime should treat skills as `scaffold` quality
 * (see `spark.coverageMatrix`) until SME sign-off.
 *
 * NGSS PEs are three-dimensional (Science & Engineering Practices ×
 * Disciplinary Core Ideas × Crosscutting Concepts). Each skill below
 * captures the disciplinary anchor; the runtime planner layers SEPs and
 * CCs at session-plan time. Prerequisites are within this graph.
 */
export const ngssScience9To12: SkillGraph = {
  id: "ngss-science-9-12",
  title: "Science — Grades 9–12 (NGSS HS, AI-draft)",
  version: "0.1.0-draft",
  source: "Next Generation Science Standards, High School performance expectations (2013)",
  framework: "NGSS",
  subject: "science",
  gradeBand: "9",
  skills: [
    // ---- Physical Sciences (HS-PS) ----
    {
      id: "ngss.HS-PS1-1",
      title: "Use the periodic table to predict properties",
      description:
        "I can use the patterns of the periodic table to predict the relative properties of elements.",
      subject: "science",
      gradeBand: "9",
      frameworkRefs: [{ framework: "NGSS", code: "HS-PS1-1" }],
      prerequisites: [],
    },
    {
      id: "ngss.HS-PS1-7",
      title: "Use mathematical representations to show conservation of mass",
      description:
        "I can show, using equations, that the total mass of atoms doesn't change in a chemical reaction.",
      subject: "science",
      gradeBand: "10",
      frameworkRefs: [{ framework: "NGSS", code: "HS-PS1-7" }],
      prerequisites: ["ngss.HS-PS1-1"],
    },
    {
      id: "ngss.HS-PS2-1",
      title: "Analyze motion using Newton's second law",
      description:
        "I can use F = ma to analyze the motion of an object under different forces.",
      subject: "science",
      gradeBand: "9",
      frameworkRefs: [{ framework: "NGSS", code: "HS-PS2-1" }],
      prerequisites: [],
    },
    {
      id: "ngss.HS-PS3-1",
      title: "Quantify energy changes in a closed system",
      description:
        "I can create a model to calculate how energy moves between objects in a closed system.",
      subject: "science",
      gradeBand: "10",
      frameworkRefs: [{ framework: "NGSS", code: "HS-PS3-1" }],
      prerequisites: ["ngss.HS-PS2-1"],
    },
    {
      id: "ngss.HS-PS4-1",
      title: "Apply the wave equation to mechanical and electromagnetic waves",
      description:
        "I can use the relationship v = fλ to analyze waves traveling through different media.",
      subject: "science",
      gradeBand: "11",
      frameworkRefs: [{ framework: "NGSS", code: "HS-PS4-1" }],
      prerequisites: ["ngss.HS-PS3-1"],
    },

    // ---- Life Sciences (HS-LS) ----
    {
      id: "ngss.HS-LS1-1",
      title: "Explain how DNA codes for proteins",
      description:
        "I can explain how the structure of DNA determines the proteins that carry out life functions.",
      subject: "science",
      gradeBand: "9",
      frameworkRefs: [{ framework: "NGSS", code: "HS-LS1-1" }],
      prerequisites: [],
    },
    {
      id: "ngss.HS-LS1-5",
      title: "Model photosynthesis as energy capture",
      description:
        "I can model how plants capture light energy and store it in chemical bonds.",
      subject: "science",
      gradeBand: "9",
      frameworkRefs: [{ framework: "NGSS", code: "HS-LS1-5" }],
      prerequisites: ["ngss.HS-LS1-1"],
    },
    {
      id: "ngss.HS-LS2-4",
      title: "Use mathematical reasoning for ecosystem matter and energy flow",
      description:
        "I can use math to show how matter and energy move through an ecosystem at trophic levels.",
      subject: "science",
      gradeBand: "10",
      frameworkRefs: [{ framework: "NGSS", code: "HS-LS2-4" }],
      prerequisites: ["ngss.HS-LS1-5"],
    },
    {
      id: "ngss.HS-LS3-2",
      title: "Explain causes of genetic variation",
      description:
        "I can explain how genetic variation arises from mutations, meiosis, and sexual reproduction.",
      subject: "science",
      gradeBand: "11",
      frameworkRefs: [{ framework: "NGSS", code: "HS-LS3-2" }],
      prerequisites: ["ngss.HS-LS1-1"],
    },
    {
      id: "ngss.HS-LS4-2",
      title: "Construct an explanation of evolution by natural selection",
      description:
        "I can construct an evidence-based explanation of how natural selection leads to adaptation.",
      subject: "science",
      gradeBand: "11",
      frameworkRefs: [{ framework: "NGSS", code: "HS-LS4-2" }],
      prerequisites: ["ngss.HS-LS3-2"],
    },

    // ---- Earth & Space Sciences (HS-ESS) ----
    {
      id: "ngss.HS-ESS1-1",
      title: "Develop a model of the Sun's energy from fusion",
      description:
        "I can develop a model showing how the Sun releases energy through nuclear fusion.",
      subject: "science",
      gradeBand: "9",
      frameworkRefs: [{ framework: "NGSS", code: "HS-ESS1-1" }],
      prerequisites: [],
    },
    {
      id: "ngss.HS-ESS2-4",
      title: "Use a model to analyze Earth's climate system",
      description:
        "I can use a model to analyze how Earth's energy flows drive changes in climate.",
      subject: "science",
      gradeBand: "10",
      frameworkRefs: [{ framework: "NGSS", code: "HS-ESS2-4" }],
      prerequisites: ["ngss.HS-PS3-1"],
    },
    {
      id: "ngss.HS-ESS3-5",
      title: "Analyze evidence of human impact on climate",
      description:
        "I can analyze geoscience data and model results to make a forecast about climate change.",
      subject: "science",
      gradeBand: "11",
      frameworkRefs: [{ framework: "NGSS", code: "HS-ESS3-5" }],
      prerequisites: ["ngss.HS-ESS2-4"],
    },

    // ---- Engineering Design (HS-ETS) ----
    {
      id: "ngss.HS-ETS1-2",
      title: "Break a complex design problem into solvable parts",
      description:
        "I can break a major global challenge into smaller engineering problems I can solve.",
      subject: "science",
      gradeBand: "10",
      frameworkRefs: [{ framework: "NGSS-Engineering", code: "HS-ETS1-2" }],
      prerequisites: [],
    },
    {
      id: "ngss.HS-ETS1-3",
      title: "Evaluate a solution against criteria and constraints",
      description:
        "I can evaluate a solution based on cost, safety, reliability, and environmental impact.",
      subject: "science",
      gradeBand: "11",
      frameworkRefs: [{ framework: "NGSS-Engineering", code: "HS-ETS1-3" }],
      prerequisites: ["ngss.HS-ETS1-2"],
    },
    {
      id: "ngss.HS-ETS1-4",
      title: "Use a computer simulation to model a complex system",
      description:
        "I can use a computer simulation to model a complex real-world system to test design solutions.",
      subject: "science",
      gradeBand: "12",
      frameworkRefs: [{ framework: "NGSS-Engineering", code: "HS-ETS1-4" }],
      prerequisites: ["ngss.HS-ETS1-3"],
    },
  ],
};
