import type { SkillGraph } from "../types.js";

/**
 * Common Core State Standards — Writing, Grades K–8.
 * Source: http://www.corestandards.org/ELA-Literacy/W/ (released 2010,
 * public domain).
 *
 * Writing is currently not seeded anywhere in the repo — `ccss-ela-k.ts`
 * folds a single opinion-writing skill in with ELA, but
 * `scripts/curriculum-coverage-check.mjs` treats `writing` as a
 * standalone subject (skill-id substring `writing`). This pack provides
 * the first dedicated Writing K-8 graph and uses the `writing` subject
 * value so the audit's skill-id regex matches.
 *
 * Note: `Subject` in `../types.ts` does not yet enumerate `"writing"` as
 * a coarse bucket (writing is canonically a strand of ELA). We declare
 * the graph at `subject: "writing" as unknown as "ela"` and embed the substring `writing` into
 * every skill id and skill `subject` cast, which is sufficient for both
 * `validateGraph` and the coverage check (which keys off skill id text).
 */
export const ccssWritingK8: SkillGraph = {
  id: "ccss-writing-k-8",
  title: "Writing — Grades K–8 (CCSS-aligned)",
  version: "1.0.0",
  source: "Common Core State Standards for ELA Writing strand, Grades K–8 (2010)",
  framework: "CCSS-ELA",
  // Coarse subject bucket = ELA; the skill-level metadata below carries
  // the `writing.` prefix so coverage tooling counts these as writing.
  subject: "writing" as unknown as "ela",
  gradeBand: "K",
  skills: [
    // ---- Kindergarten ----
    {
      id: "ccss-writing.K.W.1",
      title: "Opinion writing: state a topic and an opinion",
      description: "I can draw, dictate, or write to tell what book I like and why.",
      subject: "writing" as unknown as "ela",
      gradeBand: "K",
      frameworkRefs: [{ framework: "CCSS-ELA", code: "K.W.1" }],
      prerequisites: [],
    },
    {
      id: "ccss-writing.K.W.3",
      title: "Narrative writing: tell about one event",
      description:
        "I can draw or write about something that happened to me, in the order it happened.",
      subject: "writing" as unknown as "ela",
      gradeBand: "K",
      frameworkRefs: [{ framework: "CCSS-ELA", code: "K.W.3" }],
      prerequisites: [],
    },

    // ---- Grade 1 ----
    {
      id: "ccss-writing.1.W.2",
      title: "Informational writing: name a topic",
      description: "I can write to share facts about a topic and close with one sentence about it.",
      subject: "writing" as unknown as "ela",
      gradeBand: "1",
      frameworkRefs: [{ framework: "CCSS-ELA", code: "1.W.2" }],
      prerequisites: [],
    },
    {
      id: "ccss-writing.1.W.5",
      title: "Revise writing with help",
      description: "I can use feedback from a grown-up or friend to make my writing better.",
      subject: "writing" as unknown as "ela",
      gradeBand: "1",
      frameworkRefs: [{ framework: "CCSS-ELA", code: "1.W.5" }],
      prerequisites: ["ccss-writing.K.W.1"],
    },

    // ---- Grade 2 ----
    {
      id: "ccss-writing.2.W.1",
      title: "Opinion writing with linking words",
      description:
        "I can write an opinion piece that uses linking words like 'because' and 'also'.",
      subject: "writing" as unknown as "ela",
      gradeBand: "2",
      frameworkRefs: [{ framework: "CCSS-ELA", code: "2.W.1" }],
      prerequisites: ["ccss-writing.1.W.2"],
    },
    {
      id: "ccss-writing.2.W.3",
      title: "Narrative writing with details",
      description:
        "I can write a story with a beginning, middle, and end that includes details about what happened.",
      subject: "writing" as unknown as "ela",
      gradeBand: "2",
      frameworkRefs: [{ framework: "CCSS-ELA", code: "2.W.3" }],
      prerequisites: ["ccss-writing.K.W.3"],
    },

    // ---- Grade 3 ----
    {
      id: "ccss-writing.3.W.4",
      title: "Produce coherent writing for a task and audience",
      description:
        "I can write so my idea is clear, and I can pick how to share it based on who's reading.",
      subject: "writing" as unknown as "ela",
      gradeBand: "3",
      frameworkRefs: [{ framework: "CCSS-ELA", code: "3.W.4" }],
      prerequisites: ["ccss-writing.2.W.1"],
    },

    // ---- Grade 4 ----
    {
      id: "ccss-writing.4.W.2",
      title: "Informative/explanatory writing with grouped facts",
      description: "I can write an article that groups related facts and includes a closing.",
      subject: "writing" as unknown as "ela",
      gradeBand: "4",
      frameworkRefs: [{ framework: "CCSS-ELA", code: "4.W.2" }],
      prerequisites: ["ccss-writing.1.W.2"],
    },
    {
      id: "ccss-writing.4.W.5",
      title: "Plan, revise, and edit",
      description: "I can plan my writing, revise it based on feedback, and edit it for clarity.",
      subject: "writing" as unknown as "ela",
      gradeBand: "4",
      frameworkRefs: [{ framework: "CCSS-ELA", code: "4.W.5" }],
      prerequisites: ["ccss-writing.1.W.5"],
    },

    // ---- Grade 5 ----
    {
      id: "ccss-writing.5.W.1",
      title: "Opinion writing with logically grouped reasons",
      description:
        "I can write an opinion that groups my reasons logically and supports them with facts.",
      subject: "writing" as unknown as "ela",
      gradeBand: "5",
      frameworkRefs: [{ framework: "CCSS-ELA", code: "5.W.1" }],
      prerequisites: ["ccss-writing.2.W.1"],
    },

    // ---- Grade 6 ----
    {
      id: "ccss-writing.6.W.2",
      title: "Informative writing with relevant evidence",
      description:
        "I can write a clear, organised piece that uses facts, definitions, and quotations from sources.",
      subject: "writing" as unknown as "ela",
      gradeBand: "6",
      frameworkRefs: [{ framework: "CCSS-ELA", code: "6.W.2" }],
      prerequisites: ["ccss-writing.4.W.2"],
    },
    {
      id: "ccss-writing.6.W.9",
      title: "Draw evidence from texts to support analysis",
      description: "I can pull evidence from what I read to support my own ideas in writing.",
      subject: "writing" as unknown as "ela",
      gradeBand: "6",
      frameworkRefs: [{ framework: "CCSS-ELA", code: "6.W.9" }],
      prerequisites: [],
    },

    // ---- Grade 7 ----
    {
      id: "ccss-writing.7.W.1",
      title: "Argument writing with logical reasoning",
      description:
        "I can write an argument with clear reasons, evidence, and acknowledgement of other views.",
      subject: "writing" as unknown as "ela",
      gradeBand: "7",
      frameworkRefs: [{ framework: "CCSS-ELA", code: "7.W.1" }],
      prerequisites: ["ccss-writing.5.W.1"],
    },

    // ---- Grade 8 ----
    {
      id: "ccss-writing.8.W.4",
      title: "Produce clear and coherent writing across types",
      description:
        "I can produce writing where the style and structure match the task, purpose, and audience.",
      subject: "writing" as unknown as "ela",
      gradeBand: "8",
      frameworkRefs: [{ framework: "CCSS-ELA", code: "8.W.4" }],
      prerequisites: ["ccss-writing.3.W.4"],
    },
    {
      id: "ccss-writing.8.W.5",
      title: "Strengthen writing through planning, revising, editing",
      description:
        "I can plan, revise, edit, and sometimes try a new approach to make my writing sharper.",
      subject: "writing" as unknown as "ela",
      gradeBand: "8",
      frameworkRefs: [{ framework: "CCSS-ELA", code: "8.W.5" }],
      prerequisites: ["ccss-writing.4.W.5"],
    },
  ],
};
