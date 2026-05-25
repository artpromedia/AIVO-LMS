import type { SkillGraph } from "../types.js";

/**
 * NCGE Geography for Life — Grades 3–12 expansion for Atlas.
 * Source: National Geography Standards (NCGE / NGS / AAG 2nd ed. 2012).
 *
 * AI-DRAFT — anchored to the 18 National Geography Standards across the
 * 6 essential elements (World in Spatial Terms, Places & Regions,
 * Physical Systems, Human Systems, Environment & Society, Uses of
 * Geography). NOT YET reviewed by a credentialed geography educator;
 * runtime should treat skills as `scaffold` (see `atlas.coverageMatrix`)
 * until SME sign-off.
 */
export const ncgeGeography3To12: SkillGraph = {
  id: "ncge-geography-3-12",
  title: "Geography & World Cultures — Grades 3–12 (NCGE, AI-draft)",
  version: "0.1.0-draft",
  source: "National Geography Standards (Geography for Life, 2nd ed., 2012)",
  framework: "NCGE",
  subject: "geography",
  gradeBand: "3",
  skills: [
    {
      id: "ncge.std1.elem",
      title: "Use maps and spatial tools to find information",
      description: "I can use maps, globes, and spatial tools to find places and patterns.",
      subject: "geography",
      gradeBand: "3",
      frameworkRefs: [{ framework: "NCGE", code: "Standard 1" }],
      prerequisites: [],
    },
    {
      id: "ncge.std4.elem",
      title: "Describe physical and human characteristics of places",
      description: "I can describe what a place is like — its landforms, climate, and people.",
      subject: "geography",
      gradeBand: "4",
      frameworkRefs: [{ framework: "NCGE", code: "Standard 4" }],
      prerequisites: ["ncge.std1.elem"],
    },
    {
      id: "ncge.std9.elem",
      title: "Explain how people change places",
      description: "I can explain how people change a place by building, farming, or settling.",
      subject: "geography",
      gradeBand: "5",
      frameworkRefs: [{ framework: "NCGE", code: "Standard 9" }],
      prerequisites: ["ncge.std4.elem"],
    },
    {
      id: "ncge.std5.ms",
      title: "Describe regions and their changing nature",
      description: "I can describe a region's identity and explain how regions change over time.",
      subject: "geography",
      gradeBand: "6",
      frameworkRefs: [{ framework: "NCGE", code: "Standard 5" }],
      prerequisites: ["ncge.std4.elem"],
    },
    {
      id: "ncge.std11.ms",
      title: "Analyze the patterns and networks of economic interdependence",
      description: "I can explain how trade and money link places across the world.",
      subject: "geography",
      gradeBand: "7",
      frameworkRefs: [{ framework: "NCGE", code: "Standard 11" }],
      prerequisites: ["ncge.std9.elem"],
    },
    {
      id: "ncge.std14.ms",
      title: "Explain how humans modify the environment",
      description: "I can explain how human activities change the physical environment.",
      subject: "geography",
      gradeBand: "8",
      frameworkRefs: [{ framework: "NCGE", code: "Standard 14" }],
      prerequisites: ["ncge.std9.elem"],
    },
    {
      id: "ncge.std2.hs",
      title: "Use mental maps to organize spatial information",
      description: "I can construct and use mental maps to analyze geographic patterns.",
      subject: "geography",
      gradeBand: "9",
      frameworkRefs: [{ framework: "NCGE", code: "Standard 2" }],
      prerequisites: ["ncge.std1.elem"],
    },
    {
      id: "ncge.std10.hs",
      title: "Analyze cultural mosaics in regions",
      description: "I can analyze how culture shapes — and is shaped by — places and regions.",
      subject: "geography",
      gradeBand: "10",
      frameworkRefs: [{ framework: "NCGE", code: "Standard 10" }],
      prerequisites: ["ncge.std5.ms"],
    },
    {
      id: "ncge.std15.hs",
      title: "Evaluate environmental impacts and sustainability",
      description: "I can evaluate the environmental consequences of human decisions and propose alternatives.",
      subject: "geography",
      gradeBand: "11",
      frameworkRefs: [{ framework: "NCGE", code: "Standard 15" }],
      prerequisites: ["ncge.std14.ms"],
    },
    {
      id: "ncge.std18.hs",
      title: "Apply geography to interpret present and plan for future",
      description: "I can apply geographic thinking to interpret current events and plan for the future.",
      subject: "geography",
      gradeBand: "12",
      frameworkRefs: [{ framework: "NCGE", code: "Standard 18" }],
      prerequisites: ["ncge.std11.ms", "ncge.std15.hs"],
    },
  ],
};
