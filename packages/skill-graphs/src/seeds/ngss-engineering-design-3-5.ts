import type { SkillGraph } from "../types.js";

/**
 * NGSS Engineering Design — Grades 3–5 starter slice for Forge.
 * Source: Next Generation Science Standards, Engineering Design strand
 * (3-5-ETS1). Forge's tutor catalog gates this tutor to MIDDLE+HIGH
 * tiers; this graph anchors the entry-level engineering-design loop
 * (define → plan → test → improve) used across the catalog's projects.
 */
export const ngssEngineeringDesign35: SkillGraph = {
  id: "ngss-engineering-design-3-5",
  title: "STEM & Engineering Design — Grades 3–5 (NGSS-aligned)",
  version: "1.0.0",
  source: "Next Generation Science Standards — Engineering Design 3-5 (2013)",
  framework: "NGSS-Engineering",
  subject: "stem_engineering",
  gradeBand: "3",
  skills: [
    {
      id: "ngss.eng.3-5.ETS1-1",
      title: "Define a design problem with constraints",
      description: "I can describe a problem to solve and the rules I have to follow.",
      subject: "stem_engineering",
      gradeBand: "3",
      frameworkRefs: [{ framework: "NGSS-Engineering", code: "3-5-ETS1-1" }],
      prerequisites: [],
    },
    {
      id: "ngss.eng.3-5.ETS1-2",
      title: "Generate and compare possible solutions",
      description: "I can think of more than one way to solve a problem and compare them.",
      subject: "stem_engineering",
      gradeBand: "3",
      frameworkRefs: [{ framework: "NGSS-Engineering", code: "3-5-ETS1-2" }],
      prerequisites: ["ngss.eng.3-5.ETS1-1"],
    },
    {
      id: "ngss.eng.3-5.ETS1-3.test",
      title: "Plan and run a fair test",
      description: "I can plan a test that changes one thing at a time.",
      subject: "stem_engineering",
      gradeBand: "3",
      frameworkRefs: [{ framework: "NGSS-Engineering", code: "3-5-ETS1-3" }],
      prerequisites: ["ngss.eng.3-5.ETS1-2"],
    },
    {
      id: "ngss.eng.3-5.ETS1-3.iterate",
      title: "Improve a design from test results",
      description: "I can use what I learned to make my design better.",
      subject: "stem_engineering",
      gradeBand: "3",
      frameworkRefs: [{ framework: "NGSS-Engineering", code: "3-5-ETS1-3" }],
      prerequisites: ["ngss.eng.3-5.ETS1-3.test"],
    },
    {
      id: "ngss.eng.3-5.notebook",
      title: "Document my work in an engineering notebook",
      description: "I can sketch and write what I tried and what happened.",
      subject: "stem_engineering",
      gradeBand: "3",
      frameworkRefs: [{ framework: "NGSS-Engineering", code: "3-5-ETS1-2" }],
      prerequisites: ["ngss.eng.3-5.ETS1-1"],
    },
  ],
};
