import type { SkillGraph } from "../types.js";

/**
 * NCAS Creative Arts (Visual / Theater / Dance / Media) — Grades 3–12 for Muse.
 * Source: National Core Arts Standards (NCAS, NCCAS 2014).
 *
 * AI-DRAFT — anchored to NCAS's four artistic processes (Create,
 * Perform / Present / Produce, Respond, Connect) across the visual,
 * theater, dance, and media-arts disciplines. NOT YET reviewed by a
 * credentialed arts educator; runtime should treat skills as
 * `scaffold` (see `muse.coverageMatrix`) until SME sign-off.
 */
export const ncasCreativeArts3To12: SkillGraph = {
  id: "ncas-creative-arts-3-12",
  title: "Creative Arts & Expression — Grades 3–12 (NCAS, AI-draft)",
  version: "1.0.0",
  source: "National Core Arts Standards (NCCAS 2014) — Visual/Theater/Dance/Media",
  framework: "NCAS",
  subject: "creative_arts",
  gradeBand: "3",
  skills: [
    {
      id: "ncas.ca.cr1.3",
      title: "Generate ideas for creative work",
      description: "I can brainstorm many ideas for an artwork, story, or performance.",
      subject: "creative_arts",
      gradeBand: "3",
      frameworkRefs: [{ framework: "NCAS", code: "Cr1.1" }],
      prerequisites: [],
    },
    {
      id: "ncas.ca.cr2.5",
      title: "Use materials and techniques to develop work",
      description: "I can choose materials and techniques that fit what I'm trying to make.",
      subject: "creative_arts",
      gradeBand: "5",
      frameworkRefs: [{ framework: "NCAS", code: "Cr2.1" }],
      prerequisites: ["ncas.ca.cr1.3"],
    },
    {
      id: "ncas.ca.cr3.7",
      title: "Revise creative work with feedback",
      description: "I can revise my work using feedback to strengthen its message and craft.",
      subject: "creative_arts",
      gradeBand: "7",
      frameworkRefs: [{ framework: "NCAS", code: "Cr3.1" }],
      prerequisites: ["ncas.ca.cr2.5"],
    },
    {
      id: "ncas.ca.pr4.4",
      title: "Select work to present with intention",
      description: "I can choose work to share that fits my purpose and audience.",
      subject: "creative_arts",
      gradeBand: "4",
      frameworkRefs: [{ framework: "NCAS", code: "Pr4.1" }],
      prerequisites: ["ncas.ca.cr1.3"],
    },
    {
      id: "ncas.ca.pr6.9",
      title: "Convey meaning through performance or display",
      description: "I can present work in ways that convey meaning and engage an audience.",
      subject: "creative_arts",
      gradeBand: "9",
      frameworkRefs: [{ framework: "NCAS", code: "Pr6.1" }],
      prerequisites: ["ncas.ca.cr3.7", "ncas.ca.pr4.4"],
    },
    {
      id: "ncas.ca.re7.6",
      title: "Perceive and analyze artistic work",
      description: "I can describe how an artist's choices create meaning in a work.",
      subject: "creative_arts",
      gradeBand: "6",
      frameworkRefs: [{ framework: "NCAS", code: "Re7.1" }],
      prerequisites: [],
    },
    {
      id: "ncas.ca.re8.10",
      title: "Interpret intent and meaning in artwork",
      description:
        "I can interpret a work by analyzing artistic choices, context, and personal response.",
      subject: "creative_arts",
      gradeBand: "10",
      frameworkRefs: [{ framework: "NCAS", code: "Re8.1" }],
      prerequisites: ["ncas.ca.re7.6"],
    },
    {
      id: "ncas.ca.re9.11",
      title: "Apply criteria to evaluate creative work",
      description: "I can use established and personal criteria to evaluate creative work.",
      subject: "creative_arts",
      gradeBand: "11",
      frameworkRefs: [{ framework: "NCAS", code: "Re9.1" }],
      prerequisites: ["ncas.ca.re8.10"],
    },
    {
      id: "ncas.ca.cn10.8",
      title: "Connect creative work to personal experience",
      description: "I can connect creative work to my own life and experiences.",
      subject: "creative_arts",
      gradeBand: "8",
      frameworkRefs: [{ framework: "NCAS", code: "Cn10.1" }],
      prerequisites: ["ncas.ca.re7.6"],
    },
    {
      id: "ncas.ca.cn11.12",
      title: "Relate creative work to society, culture, and history",
      description: "I can analyze how creative work both reflects and shapes its cultural context.",
      subject: "creative_arts",
      gradeBand: "12",
      frameworkRefs: [{ framework: "NCAS", code: "Cn11.1" }],
      prerequisites: ["ncas.ca.cn10.8", "ncas.ca.re9.11"],
    },
  ],
};
