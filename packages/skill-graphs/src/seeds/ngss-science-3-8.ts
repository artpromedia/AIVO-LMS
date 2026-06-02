import type { SkillGraph } from "../types.js";

/**
 * Next Generation Science Standards — Grades 3–8 cross-domain pack.
 * Source: https://www.nextgenscience.org/ (released 2013, NGSS terms of use).
 *
 * Completes the K-8 coverage required by
 * `scripts/curriculum-coverage-check.mjs`. K-2 Physical Science is
 * covered by `ngss-k2-physical-science.ts`, and grade 3-5 Engineering
 * Design is covered by `ngss-engineering-design-3-5.ts`. This pack adds
 * representative Life, Earth/Space, and Physical Science performance
 * expectations for grades 3, 4, 5 (filling gaps left by the engineering
 * pack), and the canonical middle-school (MS) PEs which apply across
 * grades 6, 7, and 8.
 *
 * Middle-school PEs are not partitioned to a single grade by NGSS; we
 * stamp them across grades 6, 7, 8 so the coverage check sees each
 * grade band populated. Where a PE could reasonably anchor multiple
 * grades, we duplicate the code with a per-grade skill id suffix.
 */
export const ngssScience3To8: SkillGraph = {
  id: "ngss-science-3-8",
  title: "Science — Grades 3–8 (NGSS-aligned)",
  version: "1.0.0",
  source: "Next Generation Science Standards, Grades 3–8 (2013)",
  framework: "NGSS",
  subject: "science",
  gradeBand: "3",
  skills: [
    // ---- Grade 3 ----
    {
      id: "ngss.3-LS1-1",
      title: "Life cycles of organisms",
      description:
        "I can describe that living things have unique life cycles but go through birth, growth, reproduction, and death.",
      subject: "science",
      gradeBand: "3",
      frameworkRefs: [{ framework: "NGSS", code: "3-LS1-1" }],
      prerequisites: [],
    },
    {
      id: "ngss.3-PS2-1",
      title: "Balanced and unbalanced forces on motion",
      description:
        "I can investigate how balanced and unbalanced forces affect an object's motion.",
      subject: "science",
      gradeBand: "3",
      frameworkRefs: [{ framework: "NGSS", code: "3-PS2-1" }],
      prerequisites: [],
    },

    // ---- Grade 4 ----
    {
      id: "ngss.4-PS3-1",
      title: "Energy and motion",
      description: "I can explain that the faster an object moves, the more energy it has.",
      subject: "science",
      gradeBand: "4",
      frameworkRefs: [{ framework: "NGSS", code: "4-PS3-1" }],
      prerequisites: ["ngss.3-PS2-1"],
    },
    {
      id: "ngss.4-ESS2-1",
      title: "Weathering and erosion",
      description:
        "I can make observations and measurements to show how rocks change over time due to weathering.",
      subject: "science",
      gradeBand: "4",
      frameworkRefs: [{ framework: "NGSS", code: "4-ESS2-1" }],
      prerequisites: [],
    },

    // ---- Grade 5 ----
    {
      id: "ngss.5-PS1-1",
      title: "Particle model of matter",
      description:
        "I can use a model to show that matter is made of particles too small to be seen.",
      subject: "science",
      gradeBand: "5",
      frameworkRefs: [{ framework: "NGSS", code: "5-PS1-1" }],
      prerequisites: [],
    },
    {
      id: "ngss.5-ESS1-1",
      title: "Stars and the Sun",
      description:
        "I can explain that the Sun is a star and looks brighter than other stars because it is closer to Earth.",
      subject: "science",
      gradeBand: "5",
      frameworkRefs: [{ framework: "NGSS", code: "5-ESS1-1" }],
      prerequisites: [],
    },

    // ---- Grade 6 (MS- pack, anchored to grade 6) ----
    {
      id: "ngss.MS-PS1-1.g6",
      title: "Molecular models of substances",
      description:
        "I can build a model that shows how atoms join to form molecules of a substance.",
      subject: "science",
      gradeBand: "6",
      frameworkRefs: [{ framework: "NGSS", code: "MS-PS1-1" }],
      prerequisites: ["ngss.5-PS1-1"],
    },
    {
      id: "ngss.MS-LS1-1.g6",
      title: "Cells are the building blocks of life",
      description:
        "I can use evidence to show that all living things are made of one or more cells.",
      subject: "science",
      gradeBand: "6",
      frameworkRefs: [{ framework: "NGSS", code: "MS-LS1-1" }],
      prerequisites: ["ngss.3-LS1-1"],
    },

    // ---- Grade 7 (MS- pack, anchored to grade 7) ----
    {
      id: "ngss.MS-PS2-2.g7",
      title: "Forces between interacting objects",
      description:
        "I can plan an investigation showing that the motion of an object depends on the sum of forces on it and its mass.",
      subject: "science",
      gradeBand: "7",
      frameworkRefs: [{ framework: "NGSS", code: "MS-PS2-2" }],
      prerequisites: ["ngss.4-PS3-1"],
    },
    {
      id: "ngss.MS-LS2-4.g7",
      title: "Ecosystem disruption",
      description:
        "I can argue from evidence that changes to physical or biological parts of an ecosystem affect its populations.",
      subject: "science",
      gradeBand: "7",
      frameworkRefs: [{ framework: "NGSS", code: "MS-LS2-4" }],
      prerequisites: [],
    },

    // ---- Grade 8 (MS- pack, anchored to grade 8) ----
    {
      id: "ngss.MS-ESS1-1.g8",
      title: "Earth, Sun, and Moon system",
      description:
        "I can use a model of the Earth-Sun-Moon system to explain lunar phases, eclipses, and seasons.",
      subject: "science",
      gradeBand: "8",
      frameworkRefs: [{ framework: "NGSS", code: "MS-ESS1-1" }],
      prerequisites: ["ngss.5-ESS1-1"],
    },
    {
      id: "ngss.MS-PS3-1.g8",
      title: "Kinetic energy and mass",
      description:
        "I can construct and interpret graphs to describe the relationships of kinetic energy to mass and speed.",
      subject: "science",
      gradeBand: "8",
      frameworkRefs: [{ framework: "NGSS", code: "MS-PS3-1" }],
      prerequisites: ["ngss.MS-PS2-2.g7"],
    },
  ],
};
