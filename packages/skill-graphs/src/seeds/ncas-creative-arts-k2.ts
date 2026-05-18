import type { SkillGraph } from "../types.js";

/**
 * National Core Arts Standards — Visual Arts & Creative Writing,
 * Grades K–2 starter slice for Muse.
 * Source: National Coalition for Core Arts Standards (NCAS) Visual
 * Arts (2014). Creative-writing skills layer on the same Create→
 * Perform/Present→Respond→Connect arc.
 */
export const ncasCreativeArtsK2: SkillGraph = {
  id: "ncas-creative-arts-k2",
  title: "Creative Arts & Expression — Grades K–2 (NCAS-aligned)",
  version: "1.0.0",
  source: "National Core Arts Standards — Visual Arts, Grades K–2 (NCAS 2014)",
  framework: "NCAS",
  subject: "creative_arts",
  gradeBand: "K",
  skills: [
    {
      id: "ncas.arts.k2.create.imagine",
      title: "Generate ideas for a creative work",
      description:
        "I can come up with ideas for a story, drawing, or song using prompts and my imagination.",
      subject: "creative_arts",
      gradeBand: "K",
      frameworkRefs: [{ framework: "NCAS", code: "VA:Cr1.1.K" }],
      prerequisites: [],
    },
    {
      id: "ncas.arts.k2.create.draft",
      title: "Make a first version of my idea",
      description: "I can draw, write, or build a first version of my creative idea.",
      subject: "creative_arts",
      gradeBand: "K",
      frameworkRefs: [{ framework: "NCAS", code: "VA:Cr2.1.K" }],
      prerequisites: ["ncas.arts.k2.create.imagine"],
    },
    {
      id: "ncas.arts.k2.create.revise",
      title: "Revise my work after feedback",
      description:
        "I can change part of my work after I look at it again or hear ideas from a friend.",
      subject: "creative_arts",
      gradeBand: "K",
      frameworkRefs: [{ framework: "NCAS", code: "VA:Cr3.1.K" }],
      prerequisites: ["ncas.arts.k2.create.draft"],
    },
    {
      id: "ncas.arts.k2.present.share",
      title: "Share my work with a small audience",
      description: "I can show or read my work to a partner, my class, or my family.",
      subject: "creative_arts",
      gradeBand: "K",
      frameworkRefs: [{ framework: "NCAS", code: "VA:Pr4.1.K" }],
      prerequisites: ["ncas.arts.k2.create.revise"],
    },
    {
      id: "ncas.arts.k2.respond.connect",
      title: "Talk about feelings and meaning in art",
      description: "I can tell what an artwork or story makes me feel and what it might mean.",
      subject: "creative_arts",
      gradeBand: "K",
      frameworkRefs: [{ framework: "NCAS", code: "VA:Re7.2.K" }],
      prerequisites: [],
    },
  ],
};
