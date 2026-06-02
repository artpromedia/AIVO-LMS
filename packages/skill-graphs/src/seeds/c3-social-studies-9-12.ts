import type { SkillGraph } from "../types.js";

/**
 * C3 Framework — Social Studies, High School (Grades 9–12).
 * Source: NCSS College, Career, and Civic Life (C3) Framework (2013).
 *
 * AI-DRAFT — anchored to C3 indicator codes for grades 9–12 across the
 * four dimensions (Questions → Disciplinary Concepts → Sources →
 * Communication) and the four disciplines (History, Civics, Geography,
 * Economics). NOT YET reviewed by a credentialed secondary
 * social-studies curriculum designer; runtime should treat skills as
 * `scaffold` quality (see `chrono.coverageMatrix`) until SME sign-off.
 *
 * Covers the typical HS sequence: World History (grade 9–10), US
 * History (10–11), Civics / Government (11–12), Economics (12).
 * Prerequisites are within this graph.
 */
export const c3SocialStudies9To12: SkillGraph = {
  id: "c3-social-studies-9-12",
  title: "Social Studies & History — Grades 9–12 (C3 HS, AI-draft)",
  version: "0.1.0-draft",
  source: "NCSS C3 Framework for Social Studies State Standards (2013), grades 9–12 indicators",
  framework: "C3",
  subject: "social_studies",
  gradeBand: "9",
  skills: [
    // ---- Dimension 1: Inquiry ----
    {
      id: "c3.9-12.D1.Q1",
      title: "Frame a compelling, supporting-question pair",
      description:
        "I can write a compelling question with the supporting questions I need to answer it.",
      subject: "social_studies",
      gradeBand: "9",
      frameworkRefs: [{ framework: "C3", code: "D1.1.9-12" }],
      prerequisites: [],
    },

    // ---- Dimension 2: History (World, then US) ----
    {
      id: "c3.9-12.D2.His.14",
      title: "Analyze multiple causes of a historical development",
      description:
        "I can analyze how multiple causes — political, economic, social, technological — combine to produce a historical event.",
      subject: "social_studies",
      gradeBand: "9",
      frameworkRefs: [{ framework: "C3", code: "D2.His.14.9-12" }],
      prerequisites: ["c3.9-12.D1.Q1"],
    },
    {
      id: "c3.9-12.D2.His.5",
      title: "Analyze how historical context shapes a source",
      description:
        "I can analyze how a source's historical context shapes the author's perspective and purpose.",
      subject: "social_studies",
      gradeBand: "10",
      frameworkRefs: [{ framework: "C3", code: "D2.His.5.9-12" }],
      prerequisites: ["c3.9-12.D2.His.14"],
    },
    {
      id: "c3.9-12.D2.His.16",
      title: "Construct historical argument with competing interpretations",
      description:
        "I can construct a historical argument that addresses competing interpretations and uses evidence.",
      subject: "social_studies",
      gradeBand: "11",
      frameworkRefs: [{ framework: "C3", code: "D2.His.16.9-12" }],
      prerequisites: ["c3.9-12.D2.His.5"],
    },

    // ---- Dimension 2: Civics ----
    {
      id: "c3.9-12.D2.Civ.5",
      title: "Evaluate citizens' and institutions' effectiveness",
      description:
        "I can evaluate how citizens and institutions address social and political problems at different levels.",
      subject: "social_studies",
      gradeBand: "11",
      frameworkRefs: [{ framework: "C3", code: "D2.Civ.5.9-12" }],
      prerequisites: ["c3.9-12.D1.Q1"],
    },
    {
      id: "c3.9-12.D2.Civ.8",
      title: "Evaluate social and political systems for liberty and equality",
      description: "I can evaluate how social and political systems balance liberty and equality.",
      subject: "social_studies",
      gradeBand: "12",
      frameworkRefs: [{ framework: "C3", code: "D2.Civ.8.9-12" }],
      prerequisites: ["c3.9-12.D2.Civ.5"],
    },
    {
      id: "c3.9-12.D2.Civ.13",
      title: "Evaluate public policies with evidence",
      description:
        "I can evaluate public policies in terms of their intended and unintended outcomes.",
      subject: "social_studies",
      gradeBand: "12",
      frameworkRefs: [{ framework: "C3", code: "D2.Civ.13.9-12" }],
      prerequisites: ["c3.9-12.D2.Civ.8"],
    },

    // ---- Dimension 2: Geography ----
    {
      id: "c3.9-12.D2.Geo.2",
      title: "Use maps and spatial data to analyze a place",
      description:
        "I can use maps and spatial data to analyze the human and physical features of a place.",
      subject: "social_studies",
      gradeBand: "9",
      frameworkRefs: [{ framework: "C3", code: "D2.Geo.2.9-12" }],
      prerequisites: [],
    },
    {
      id: "c3.9-12.D2.Geo.10",
      title: "Evaluate how geographic factors shape policy",
      description:
        "I can evaluate how environmental, cultural, and economic factors shape public policy decisions.",
      subject: "social_studies",
      gradeBand: "11",
      frameworkRefs: [{ framework: "C3", code: "D2.Geo.10.9-12" }],
      prerequisites: ["c3.9-12.D2.Geo.2"],
    },

    // ---- Dimension 2: Economics ----
    {
      id: "c3.9-12.D2.Eco.1",
      title: "Analyze how incentives drive economic choices",
      description:
        "I can analyze how incentives influence the choices of individuals, businesses, and governments.",
      subject: "social_studies",
      gradeBand: "10",
      frameworkRefs: [{ framework: "C3", code: "D2.Eco.1.9-12" }],
      prerequisites: [],
    },
    {
      id: "c3.9-12.D2.Eco.5",
      title: "Explain how monetary and fiscal policy affect the economy",
      description:
        "I can explain how government spending, taxes, and central-bank decisions affect employment and prices.",
      subject: "social_studies",
      gradeBand: "12",
      frameworkRefs: [{ framework: "C3", code: "D2.Eco.5.9-12" }],
      prerequisites: ["c3.9-12.D2.Eco.1"],
    },
    {
      id: "c3.9-12.D2.Eco.15",
      title: "Analyze how trade and finance shape the global economy",
      description:
        "I can analyze how international trade and financial flows shape national and global economies.",
      subject: "social_studies",
      gradeBand: "12",
      frameworkRefs: [{ framework: "C3", code: "D2.Eco.15.9-12" }],
      prerequisites: ["c3.9-12.D2.Eco.5"],
    },

    // ---- Dimension 3: Evidence ----
    {
      id: "c3.9-12.D3.Src.2",
      title: "Evaluate credibility of sources",
      description: "I can evaluate sources by their origins, authority, and intended audience.",
      subject: "social_studies",
      gradeBand: "10",
      frameworkRefs: [{ framework: "C3", code: "D3.2.9-12" }],
      prerequisites: ["c3.9-12.D1.Q1"],
    },
    {
      id: "c3.9-12.D3.Evi.3",
      title: "Refine claims using evidence from multiple sources",
      description:
        "I can refine claims and counterclaims using evidence from multiple sources, attending to gaps and contradictions.",
      subject: "social_studies",
      gradeBand: "11",
      frameworkRefs: [{ framework: "C3", code: "D3.3.9-12" }],
      prerequisites: ["c3.9-12.D3.Src.2"],
    },

    // ---- Dimension 4: Communicating & taking action ----
    {
      id: "c3.9-12.D4.Com.3",
      title: "Construct an argument with precise claims",
      description:
        "I can construct an argument with precise claims and pertinent evidence appropriate for the audience.",
      subject: "social_studies",
      gradeBand: "11",
      frameworkRefs: [{ framework: "C3", code: "D4.3.9-12" }],
      prerequisites: ["c3.9-12.D3.Evi.3", "c3.9-12.D2.His.16"],
    },
    {
      id: "c3.9-12.D4.Act.7",
      title: "Take informed civic action",
      description: "I can identify and plan civic actions to address a problem I have researched.",
      subject: "social_studies",
      gradeBand: "12",
      frameworkRefs: [{ framework: "C3", code: "D4.7.9-12" }],
      prerequisites: ["c3.9-12.D4.Com.3", "c3.9-12.D2.Civ.13"],
    },
  ],
};
