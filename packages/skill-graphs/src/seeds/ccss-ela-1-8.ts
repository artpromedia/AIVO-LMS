import type { SkillGraph } from "../types.js";

/**
 * Common Core State Standards — English Language Arts, Grades 1–8.
 * Source: http://www.corestandards.org/ELA-Literacy/ (released 2010,
 * public domain).
 *
 * Completes the K-8 ELA coverage required by
 * `scripts/curriculum-coverage-check.mjs`. K is already covered by
 * `ccss-ela-k.ts`. Each grade contributes representative skills from
 * the Reading Foundational (RF), Reading Literature (RL), Reading
 * Informational (RI), Language (L), and Speaking & Listening (SL)
 * strands.
 */
export const ccssEla1To8: SkillGraph = {
  id: "ccss-ela-1-8",
  title: "English Language Arts — Grades 1–8 (CCSS-aligned)",
  version: "1.0.0",
  source: "Common Core State Standards for ELA, Grades 1–8 (2010)",
  framework: "CCSS-ELA",
  subject: "ela",
  gradeBand: "1",
  skills: [
    // ---- Grade 1 ----
    {
      id: "ccss-ela.1.RF.3",
      title: "Decode words with grade-1 phonics patterns",
      description: "I can read words using my knowledge of letter sounds and word parts.",
      subject: "ela",
      gradeBand: "1",
      frameworkRefs: [{ framework: "CCSS-ELA", code: "1.RF.3" }],
      prerequisites: [],
    },
    {
      id: "ccss-ela.1.RL.2",
      title: "Retell a story using key details",
      description: "I can retell a story I read and share the main message.",
      subject: "ela",
      gradeBand: "1",
      frameworkRefs: [{ framework: "CCSS-ELA", code: "1.RL.2" }],
      prerequisites: [],
    },
    {
      id: "ccss-ela.1.L.1",
      title: "Use complete sentences",
      description: "I can write or speak in complete sentences when I share an idea.",
      subject: "ela",
      gradeBand: "1",
      frameworkRefs: [{ framework: "CCSS-ELA", code: "1.L.1" }],
      prerequisites: [],
    },

    // ---- Grade 2 ----
    {
      id: "ccss-ela.2.RF.4",
      title: "Read with fluency to support comprehension",
      description: "I can read aloud smoothly so I understand what I'm reading.",
      subject: "ela",
      gradeBand: "2",
      frameworkRefs: [{ framework: "CCSS-ELA", code: "2.RF.4" }],
      prerequisites: ["ccss-ela.1.RF.3"],
    },
    {
      id: "ccss-ela.2.RI.2",
      title: "Identify the main topic of an informational text",
      description: "I can tell what an informational text is mostly about.",
      subject: "ela",
      gradeBand: "2",
      frameworkRefs: [{ framework: "CCSS-ELA", code: "2.RI.2" }],
      prerequisites: [],
    },
    {
      id: "ccss-ela.2.L.4",
      title: "Use context to figure out unknown words",
      description: "I can use the words around a new word to guess what it means.",
      subject: "ela",
      gradeBand: "2",
      frameworkRefs: [{ framework: "CCSS-ELA", code: "2.L.4" }],
      prerequisites: [],
    },

    // ---- Grade 3 ----
    {
      id: "ccss-ela.3.RL.2",
      title: "Recount stories and determine the central message",
      description: "I can retell a story and share the lesson the author wants me to learn.",
      subject: "ela",
      gradeBand: "3",
      frameworkRefs: [{ framework: "CCSS-ELA", code: "3.RL.2" }],
      prerequisites: ["ccss-ela.1.RL.2"],
    },
    {
      id: "ccss-ela.3.RI.7",
      title: "Use illustrations and text together",
      description: "I can use both the words and pictures in a text to learn information.",
      subject: "ela",
      gradeBand: "3",
      frameworkRefs: [{ framework: "CCSS-ELA", code: "3.RI.7" }],
      prerequisites: ["ccss-ela.2.RI.2"],
    },

    // ---- Grade 4 ----
    {
      id: "ccss-ela.4.RL.3",
      title: "Describe characters, settings, and events in depth",
      description:
        "I can describe a character or event using details from the story (thoughts, words, actions).",
      subject: "ela",
      gradeBand: "4",
      frameworkRefs: [{ framework: "CCSS-ELA", code: "4.RL.3" }],
      prerequisites: ["ccss-ela.3.RL.2"],
    },
    {
      id: "ccss-ela.4.RI.2",
      title: "Determine the main idea and supporting details",
      description: "I can find the main idea of a text and the details that support it.",
      subject: "ela",
      gradeBand: "4",
      frameworkRefs: [{ framework: "CCSS-ELA", code: "4.RI.2" }],
      prerequisites: ["ccss-ela.2.RI.2"],
    },

    // ---- Grade 5 ----
    {
      id: "ccss-ela.5.RL.6",
      title: "Describe point of view in narrative texts",
      description: "I can tell who is telling the story and how that changes what I learn.",
      subject: "ela",
      gradeBand: "5",
      frameworkRefs: [{ framework: "CCSS-ELA", code: "5.RL.6" }],
      prerequisites: ["ccss-ela.4.RL.3"],
    },
    {
      id: "ccss-ela.5.L.5",
      title: "Interpret figurative language",
      description: "I can figure out what similes, metaphors, and idioms mean in context.",
      subject: "ela",
      gradeBand: "5",
      frameworkRefs: [{ framework: "CCSS-ELA", code: "5.L.5" }],
      prerequisites: ["ccss-ela.2.L.4"],
    },

    // ---- Grade 6 ----
    {
      id: "ccss-ela.6.RI.6",
      title: "Determine author's point of view in informational text",
      description: "I can tell the author's purpose and how it shapes the text.",
      subject: "ela",
      gradeBand: "6",
      frameworkRefs: [{ framework: "CCSS-ELA", code: "6.RI.6" }],
      prerequisites: ["ccss-ela.4.RI.2"],
    },
    {
      id: "ccss-ela.6.RL.4",
      title: "Analyse word choice and tone",
      description:
        "I can explain how the words an author chooses shape the mood of a story or poem.",
      subject: "ela",
      gradeBand: "6",
      frameworkRefs: [{ framework: "CCSS-ELA", code: "6.RL.4" }],
      prerequisites: ["ccss-ela.5.L.5"],
    },

    // ---- Grade 7 ----
    {
      id: "ccss-ela.7.RI.8",
      title: "Trace and evaluate an argument",
      description: "I can follow an author's argument and check whether it's well-supported.",
      subject: "ela",
      gradeBand: "7",
      frameworkRefs: [{ framework: "CCSS-ELA", code: "7.RI.8" }],
      prerequisites: ["ccss-ela.6.RI.6"],
    },
    {
      id: "ccss-ela.7.SL.4",
      title: "Present claims with clear reasoning",
      description: "I can give a presentation with clear reasons and evidence.",
      subject: "ela",
      gradeBand: "7",
      frameworkRefs: [{ framework: "CCSS-ELA", code: "7.SL.4" }],
      prerequisites: [],
    },

    // ---- Grade 8 ----
    {
      id: "ccss-ela.8.RL.5",
      title: "Compare structures of two texts",
      description:
        "I can compare how two stories are built (chapters, flashbacks, scenes) and explain the effect.",
      subject: "ela",
      gradeBand: "8",
      frameworkRefs: [{ framework: "CCSS-ELA", code: "8.RL.5" }],
      prerequisites: ["ccss-ela.6.RL.4"],
    },
    {
      id: "ccss-ela.8.RI.9",
      title: "Analyse conflicting information across sources",
      description: "I can compare two texts on the same topic and explain where they disagree.",
      subject: "ela",
      gradeBand: "8",
      frameworkRefs: [{ framework: "CCSS-ELA", code: "8.RI.9" }],
      prerequisites: ["ccss-ela.7.RI.8"],
    },
  ],
};
