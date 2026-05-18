import type { SkillGraph } from "../types.js";

/**
 * C3 Framework — Social Studies, Grades K–2 starter slice for Chrono.
 * Source: NCSS College, Career, and Civic Life (C3) Framework (2013).
 *
 * Models the C3 inquiry arc (Dim. 1 questions → Dim. 2 disciplinary
 * concepts → Dim. 3 sources → Dim. 4 communicate). Each skill carries an
 * NCSS-themed code; the canonical C3 indicator codes start in grade 2,
 * so we use NCSS theme letters for the K–2 anchor.
 */
export const c3SocialStudiesK2: SkillGraph = {
  id: "c3-social-studies-k2",
  title: "Social Studies & History — Grades K–2 (C3 / NCSS-aligned)",
  version: "1.0.0",
  source: "NCSS C3 Framework for Social Studies State Standards (2013)",
  framework: "C3",
  subject: "social_studies",
  gradeBand: "K",
  skills: [
    {
      id: "c3.k2.D1.Q1",
      title: "Ask a compelling question about people or events",
      description:
        "I can ask a big question about people, places, or things that happened long ago.",
      subject: "social_studies",
      gradeBand: "K",
      frameworkRefs: [{ framework: "C3", code: "D1.1.K-2" }],
      prerequisites: [],
    },
    {
      id: "c3.k2.D2.His.1",
      title: "Sequence events from past, present, future",
      description: "I can put events on a timeline and tell which came first.",
      subject: "social_studies",
      gradeBand: "K",
      frameworkRefs: [{ framework: "NCSS", code: "Theme II" }],
      prerequisites: ["c3.k2.D1.Q1"],
    },
    {
      id: "c3.k2.D2.Civ.1",
      title: "Recognize rules and roles in a community",
      description: "I can name rules at school and home and why we have them.",
      subject: "social_studies",
      gradeBand: "K",
      frameworkRefs: [{ framework: "NCSS", code: "Theme VI" }],
      prerequisites: [],
    },
    {
      id: "c3.k2.D3.Src.1",
      title: "Use a primary source as evidence",
      description:
        "I can look at a photo, object, or short text and tell what it shows about long ago.",
      subject: "social_studies",
      gradeBand: "K",
      frameworkRefs: [{ framework: "C3", code: "D3.1.K-2" }],
      prerequisites: ["c3.k2.D2.His.1"],
    },
    {
      id: "c3.k2.D4.Com.1",
      title: "Share what I learned about the past",
      description:
        "I can draw, tell, or write what I learned about someone or something from history.",
      subject: "social_studies",
      gradeBand: "K",
      frameworkRefs: [{ framework: "C3", code: "D4.1.K-2" }],
      prerequisites: ["c3.k2.D3.Src.1"],
    },
  ],
};
