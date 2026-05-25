import type { SkillGraph } from "../types.js";

/**
 * CSTA K-12 Computer Science Standards — Grades 3–12 expansion for Pixel.
 * Source: CSTA K-12 Computer Science Standards (rev. 2017).
 *
 * AI-DRAFT — anchored to CSTA Levels 1B (3–5), 2 (6–8), and 3A/3B (9–12)
 * across the five concept strands (Computing Systems, Networks &
 * Internet, Data & Analysis, Algorithms & Programming, Impacts of
 * Computing). NOT YET reviewed by a credentialed CS educator; runtime
 * should treat skills as `scaffold` (see `pixel.coverageMatrix`) until
 * SME sign-off.
 */
export const cstaCoding3To12: SkillGraph = {
  id: "csta-coding-3-12",
  title: "Coding & Computational Thinking — Grades 3–12 (CSTA, AI-draft)",
  version: "0.1.0-draft",
  source: "CSTA K-12 Computer Science Standards (2017)",
  framework: "CSTA",
  subject: "coding",
  gradeBand: "3",
  skills: [
    // ---- Level 1B (grades 3–5) ----
    {
      id: "csta.1B-AP-10",
      title: "Create programs with loops and events",
      description: "I can use loops, events, and conditionals to build a program.",
      subject: "coding",
      gradeBand: "4",
      frameworkRefs: [{ framework: "CSTA", code: "1B-AP-10" }],
      prerequisites: [],
    },
    {
      id: "csta.1B-AP-11",
      title: "Decompose a problem into smaller parts",
      description: "I can break a big problem into smaller parts I can solve one at a time.",
      subject: "coding",
      gradeBand: "5",
      frameworkRefs: [{ framework: "CSTA", code: "1B-AP-11" }],
      prerequisites: ["csta.1B-AP-10"],
    },
    {
      id: "csta.1B-DA-06",
      title: "Organize and present data",
      description: "I can organize data and use it to make a chart or answer a question.",
      subject: "coding",
      gradeBand: "5",
      frameworkRefs: [{ framework: "CSTA", code: "1B-DA-06" }],
      prerequisites: [],
    },

    // ---- Level 2 (grades 6–8) ----
    {
      id: "csta.2-AP-13",
      title: "Use variables and lists in programs",
      description: "I can use variables and lists to store information in a program.",
      subject: "coding",
      gradeBand: "6",
      frameworkRefs: [{ framework: "CSTA", code: "2-AP-13" }],
      prerequisites: ["csta.1B-AP-10"],
    },
    {
      id: "csta.2-AP-16",
      title: "Use procedures to organize a program",
      description: "I can write reusable procedures (functions) to organize code.",
      subject: "coding",
      gradeBand: "7",
      frameworkRefs: [{ framework: "CSTA", code: "2-AP-16" }],
      prerequisites: ["csta.2-AP-13"],
    },
    {
      id: "csta.2-AP-17",
      title: "Test and debug programs systematically",
      description: "I can test a program with edge cases and find bugs methodically.",
      subject: "coding",
      gradeBand: "8",
      frameworkRefs: [{ framework: "CSTA", code: "2-AP-17" }],
      prerequisites: ["csta.2-AP-16"],
    },
    {
      id: "csta.2-IC-20",
      title: "Discuss societal impacts of computing",
      description: "I can discuss how computing affects people's lives in good and bad ways.",
      subject: "coding",
      gradeBand: "8",
      frameworkRefs: [{ framework: "CSTA", code: "2-IC-20" }],
      prerequisites: [],
    },

    // ---- Level 3A (grades 9–10) ----
    {
      id: "csta.3A-AP-15",
      title: "Design algorithms with composite data",
      description: "I can design an algorithm that uses lists, dictionaries, or objects.",
      subject: "coding",
      gradeBand: "9",
      frameworkRefs: [{ framework: "CSTA", code: "3A-AP-15" }],
      prerequisites: ["csta.2-AP-16"],
    },
    {
      id: "csta.3A-AP-17",
      title: "Decompose into modular software components",
      description: "I can decompose a large program into modules with well-defined interfaces.",
      subject: "coding",
      gradeBand: "10",
      frameworkRefs: [{ framework: "CSTA", code: "3A-AP-17" }],
      prerequisites: ["csta.3A-AP-15"],
    },
    {
      id: "csta.3A-NI-04",
      title: "Apply cybersecurity concepts",
      description: "I can describe common security threats and apply basic protective measures.",
      subject: "coding",
      gradeBand: "10",
      frameworkRefs: [{ framework: "CSTA", code: "3A-NI-04" }],
      prerequisites: [],
    },

    // ---- Level 3B (grades 11–12) ----
    {
      id: "csta.3B-AP-12",
      title: "Compare data structures for a problem",
      description: "I can compare data structures and choose the right one for a problem.",
      subject: "coding",
      gradeBand: "11",
      frameworkRefs: [{ framework: "CSTA", code: "3B-AP-12" }],
      prerequisites: ["csta.3A-AP-15"],
    },
    {
      id: "csta.3B-AP-15",
      title: "Analyze algorithm efficiency",
      description: "I can analyze the time and space efficiency of algorithms.",
      subject: "coding",
      gradeBand: "12",
      frameworkRefs: [{ framework: "CSTA", code: "3B-AP-15" }],
      prerequisites: ["csta.3B-AP-12"],
    },
    {
      id: "csta.3B-IC-25",
      title: "Evaluate computing ethics and policy",
      description: "I can evaluate the ethical and policy implications of a computing system.",
      subject: "coding",
      gradeBand: "12",
      frameworkRefs: [{ framework: "CSTA", code: "3B-IC-25" }],
      prerequisites: ["csta.2-IC-20"],
    },
  ],
};
