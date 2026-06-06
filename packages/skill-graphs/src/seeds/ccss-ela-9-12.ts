import type { SkillGraph } from "../types.js";

/**
 * Common Core State Standards — English Language Arts, High School (9–12).
 * Source: http://www.corestandards.org/ELA-Literacy/ (public domain).
 *
 * AI-DRAFT — anchored to real CCSS-ELA HS strand codes (RL, RI, W, SL, L).
 * NOT YET reviewed by a credentialed secondary ELA curriculum designer;
 * runtime should treat skills as `scaffold` quality (see
 * `sage.coverageMatrix`) until SME sign-off.
 *
 * CCSS-ELA at HS is banded as 9–10 and 11–12. We model both bands with
 * representative skills across Reading Literature, Reading Informational
 * Text, Writing, Speaking & Listening, and Language. Prerequisites are
 * within this graph.
 */
export const ccssEla9To12: SkillGraph = {
  id: "ccss-ela-9-12",
  title: "English Language Arts — Grades 9–12 (CCSS HS, AI-draft)",
  version: "1.0.0",
  source: "Common Core State Standards for English Language Arts, Grades 9–12 (2010)",
  framework: "CCSS-ELA",
  subject: "ela",
  gradeBand: "9",
  skills: [
    // ---- 9–10: Reading Literature ----
    {
      id: "ccss-ela.RL.9-10.1",
      title: "Cite strong textual evidence for analysis",
      description:
        "I can cite strong, specific evidence from a text to support what I say it means.",
      subject: "ela",
      gradeBand: "9",
      frameworkRefs: [{ framework: "CCSS-ELA", code: "RL.9-10.1" }],
      prerequisites: [],
    },
    {
      id: "ccss-ela.RL.9-10.2",
      title: "Determine theme and summarize",
      description:
        "I can identify a theme of a literary text and summarize it without my own opinions.",
      subject: "ela",
      gradeBand: "9",
      frameworkRefs: [{ framework: "CCSS-ELA", code: "RL.9-10.2" }],
      prerequisites: ["ccss-ela.RL.9-10.1"],
    },
    {
      id: "ccss-ela.RL.9-10.4",
      title: "Analyze word choice and tone",
      description:
        "I can analyze how an author's word choices shape meaning and tone in a literary text.",
      subject: "ela",
      gradeBand: "10",
      frameworkRefs: [{ framework: "CCSS-ELA", code: "RL.9-10.4" }],
      prerequisites: ["ccss-ela.RL.9-10.2"],
    },

    // ---- 9–10: Reading Informational ----
    {
      id: "ccss-ela.RI.9-10.6",
      title: "Identify author's point of view and rhetoric",
      description:
        "I can identify an author's point of view and analyze how they use rhetoric to advance it.",
      subject: "ela",
      gradeBand: "10",
      frameworkRefs: [{ framework: "CCSS-ELA", code: "RI.9-10.6" }],
      prerequisites: ["ccss-ela.RL.9-10.1"],
    },
    {
      id: "ccss-ela.RI.9-10.8",
      title: "Evaluate an argument for validity",
      description:
        "I can evaluate whether an author's reasoning is valid and the evidence is sufficient.",
      subject: "ela",
      gradeBand: "10",
      frameworkRefs: [{ framework: "CCSS-ELA", code: "RI.9-10.8" }],
      prerequisites: ["ccss-ela.RI.9-10.6"],
    },

    // ---- 9–10: Writing ----
    {
      id: "ccss-ela.W.9-10.1",
      title: "Write an argument with claims and evidence",
      description:
        "I can write an argument that introduces a precise claim, supports it with evidence, and addresses counterclaims.",
      subject: "ela",
      gradeBand: "9",
      frameworkRefs: [{ framework: "CCSS-ELA", code: "W.9-10.1" }],
      prerequisites: ["ccss-ela.RI.9-10.8"],
    },
    {
      id: "ccss-ela.W.9-10.2",
      title: "Write an informative/explanatory text",
      description:
        "I can write an organized informational text that develops a topic with relevant facts and examples.",
      subject: "ela",
      gradeBand: "9",
      frameworkRefs: [{ framework: "CCSS-ELA", code: "W.9-10.2" }],
      prerequisites: [],
    },
    {
      id: "ccss-ela.W.9-10.7",
      title: "Conduct short research projects",
      description:
        "I can conduct a short research project drawing on multiple sources to answer a question.",
      subject: "ela",
      gradeBand: "10",
      frameworkRefs: [{ framework: "CCSS-ELA", code: "W.9-10.7" }],
      prerequisites: ["ccss-ela.W.9-10.2"],
    },

    // ---- 9–10: Speaking & Listening, Language ----
    {
      id: "ccss-ela.SL.9-10.4",
      title: "Present findings clearly and concisely",
      description:
        "I can present information so listeners can follow my reasoning, with appropriate eye contact and pacing.",
      subject: "ela",
      gradeBand: "10",
      frameworkRefs: [{ framework: "CCSS-ELA", code: "SL.9-10.4" }],
      prerequisites: ["ccss-ela.W.9-10.7"],
    },
    {
      id: "ccss-ela.L.9-10.1",
      title: "Demonstrate command of standard English grammar",
      description:
        "I can use parallel structure and various phrase / clause types to convey meaning clearly.",
      subject: "ela",
      gradeBand: "9",
      frameworkRefs: [{ framework: "CCSS-ELA", code: "L.9-10.1" }],
      prerequisites: [],
    },

    // ---- 11–12: Reading Literature ----
    {
      id: "ccss-ela.RL.11-12.2",
      title: "Analyze how two or more themes interact",
      description:
        "I can determine two or more themes of a text and analyze how they build on each other.",
      subject: "ela",
      gradeBand: "11",
      frameworkRefs: [{ framework: "CCSS-ELA", code: "RL.11-12.2" }],
      prerequisites: ["ccss-ela.RL.9-10.2"],
    },
    {
      id: "ccss-ela.RL.11-12.5",
      title: "Analyze how authorial choices shape structure",
      description:
        "I can analyze how an author's choices about structure (order, mystery, climax) create effects like tension or surprise.",
      subject: "ela",
      gradeBand: "11",
      frameworkRefs: [{ framework: "CCSS-ELA", code: "RL.11-12.5" }],
      prerequisites: ["ccss-ela.RL.9-10.4"],
    },

    // ---- 11–12: Reading Informational ----
    {
      id: "ccss-ela.RI.11-12.7",
      title: "Integrate information from multiple sources / media",
      description:
        "I can integrate information from multiple sources in different formats to answer a question.",
      subject: "ela",
      gradeBand: "12",
      frameworkRefs: [{ framework: "CCSS-ELA", code: "RI.11-12.7" }],
      prerequisites: ["ccss-ela.RI.9-10.8"],
    },
    {
      id: "ccss-ela.RI.11-12.8",
      title: "Evaluate seminal US documents",
      description:
        "I can evaluate the reasoning in seminal US texts (e.g. Constitution, landmark decisions).",
      subject: "ela",
      gradeBand: "12",
      frameworkRefs: [{ framework: "CCSS-ELA", code: "RI.11-12.8" }],
      prerequisites: ["ccss-ela.RI.9-10.8"],
    },

    // ---- 11–12: Writing & Research ----
    {
      id: "ccss-ela.W.11-12.1",
      title: "Write an extended argument with nuanced claims",
      description:
        "I can write an extended argument that develops nuanced claims, distinguishes them from counterclaims, and uses sustained evidence.",
      subject: "ela",
      gradeBand: "11",
      frameworkRefs: [{ framework: "CCSS-ELA", code: "W.11-12.1" }],
      prerequisites: ["ccss-ela.W.9-10.1"],
    },
    {
      id: "ccss-ela.W.11-12.7",
      title: "Conduct a sustained research project",
      description:
        "I can conduct a sustained research project, synthesizing multiple sources to answer a self-generated question.",
      subject: "ela",
      gradeBand: "12",
      frameworkRefs: [{ framework: "CCSS-ELA", code: "W.11-12.7" }],
      prerequisites: ["ccss-ela.W.9-10.7", "ccss-ela.RI.11-12.7"],
    },

    // ---- 11–12: Speaking & Language ----
    {
      id: "ccss-ela.SL.11-12.3",
      title: "Evaluate a speaker's reasoning and rhetoric",
      description:
        "I can evaluate a speaker's point of view, premises, and use of evidence and rhetoric.",
      subject: "ela",
      gradeBand: "11",
      frameworkRefs: [{ framework: "CCSS-ELA", code: "SL.11-12.3" }],
      prerequisites: ["ccss-ela.RI.9-10.8"],
    },
    {
      id: "ccss-ela.L.11-12.3",
      title: "Apply knowledge of language to make effective choices",
      description:
        "I can vary syntax for effect and apply an understanding of style in my writing and speaking.",
      subject: "ela",
      gradeBand: "11",
      frameworkRefs: [{ framework: "CCSS-ELA", code: "L.11-12.3" }],
      prerequisites: ["ccss-ela.L.9-10.1"],
    },
  ],
};
