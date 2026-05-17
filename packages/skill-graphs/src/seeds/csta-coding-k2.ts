import type { SkillGraph } from "../types.js";

/**
 * CSTA K-12 Computer Science Standards — Level 1A (Grades K–2) starter
 * slice for Pixel.
 * Source: Computer Science Teachers Association (CSTA), 2017 standards.
 *
 * Five concept strands (CS, NI, DA, AP, IC). Pixel's K–2 entry points
 * are computational systems (CS), algorithms & programming (AP), and
 * impacts of computing (IC). Higher-grade graphs add networking and
 * data analysis depth.
 */
export const cstaCodingK2: SkillGraph = {
  id: "csta-coding-k2",
  title: "Coding & Computational Thinking — Level 1A / Grades K–2 (CSTA-aligned)",
  version: "1.0.0",
  source: "CSTA K-12 Computer Science Standards (2017)",
  framework: "CSTA",
  subject: "coding",
  gradeBand: "K",
  skills: [
    {
      id: "csta.1A.CS.1",
      title: "Identify computing devices",
      description: "I can name everyday devices that use computers.",
      subject: "coding",
      gradeBand: "K",
      frameworkRefs: [{ framework: "CSTA", code: "1A-CS-01" }],
      prerequisites: [],
    },
    {
      id: "csta.1A.AP.8",
      title: "Sequence steps to solve a problem",
      description: "I can put steps in the right order to make something work.",
      subject: "coding",
      gradeBand: "K",
      frameworkRefs: [{ framework: "CSTA", code: "1A-AP-08" }],
      prerequisites: [],
    },
    {
      id: "csta.1A.AP.10",
      title: "Build simple programs with sequence and loops",
      description: "I can build a short program with steps and a repeat block.",
      subject: "coding",
      gradeBand: "K",
      frameworkRefs: [{ framework: "CSTA", code: "1A-AP-10" }],
      prerequisites: ["csta.1A.AP.8"],
    },
    {
      id: "csta.1A.AP.14",
      title: "Debug a simple program",
      description: "I can find and fix a mistake in a short program.",
      subject: "coding",
      gradeBand: "K",
      frameworkRefs: [{ framework: "CSTA", code: "1A-AP-14" }],
      prerequisites: ["csta.1A.AP.10"],
    },
    {
      id: "csta.1A.IC.18",
      title: "Discuss how technology helps people",
      description: "I can talk about ways computers help us learn, play, or stay safe.",
      subject: "coding",
      gradeBand: "K",
      frameworkRefs: [{ framework: "CSTA", code: "1A-IC-18" }],
      prerequisites: ["csta.1A.CS.1"],
    },
  ],
};
