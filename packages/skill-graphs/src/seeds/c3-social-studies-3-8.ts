import type { SkillGraph } from "../types.js";

/**
 * C3 Framework — Social Studies, Grades 3–8.
 *
 * AI-DRAFT — anchored to public-domain NCSS C3 Framework (2013) indicator
 * codes (D1.1.3-5, D2.His.1.3-5, etc.). NOT YET reviewed by a credentialed
 * social-studies curriculum designer; the runtime should treat skills from
 * this graph as `scaffold` quality (see `chrono.coverageMatrix`) until SME
 * sign-off lands. The pattern mirrors `c3-social-studies-k2.ts`: skills
 * thread the four C3 dimensions (questions → concepts → sources →
 * communication) across the History, Civics, Geography, and Economics
 * strands.
 *
 * Each grade contributes a small spine — one or two skills per strand —
 * deliberately *not* exhaustive. The intent is to give the planner a
 * routable surface at every grade, with prerequisites that ladder cleanly
 * from K–2 (within this graph; cross-graph refs would fail validateGraph).
 */
export const c3SocialStudies3To8: SkillGraph = {
  id: "c3-social-studies-3-8",
  title: "Social Studies & History — Grades 3–8 (C3 / NCSS-aligned)",
  version: "0.1.0-draft",
  source: "NCSS C3 Framework for Social Studies State Standards (2013), grades 3–8 indicators",
  framework: "C3",
  subject: "social_studies",
  gradeBand: "3",
  skills: [
    // ---- Grade 3: Local communities ----
    {
      id: "c3.3.D1.Q1",
      title: "Ask focused questions about a community",
      description:
        "I can ask a focused question about how people live and work in my community.",
      subject: "social_studies",
      gradeBand: "3",
      frameworkRefs: [{ framework: "C3", code: "D1.1.3-5" }],
      prerequisites: [],
    },
    {
      id: "c3.3.D2.His.1",
      title: "Identify change and continuity over time",
      description:
        "I can describe how my community has changed and what has stayed the same.",
      subject: "social_studies",
      gradeBand: "3",
      frameworkRefs: [{ framework: "C3", code: "D2.His.1.3-5" }],
      prerequisites: [],
    },
    {
      id: "c3.3.D2.Geo.2",
      title: "Read a map of a region",
      description:
        "I can use a map's key, scale, and directions to describe a place near me.",
      subject: "social_studies",
      gradeBand: "3",
      frameworkRefs: [{ framework: "C3", code: "D2.Geo.2.3-5" }],
      prerequisites: [],
    },
    {
      id: "c3.3.D2.Civ.6",
      title: "Explain roles of community workers and leaders",
      description:
        "I can name jobs in my community and explain how leaders are chosen.",
      subject: "social_studies",
      gradeBand: "3",
      frameworkRefs: [{ framework: "C3", code: "D2.Civ.6.3-5" }],
      prerequisites: [],
    },

    // ---- Grade 4: State / region history & geography ----
    {
      id: "c3.4.D2.His.2",
      title: "Compare perspectives on a historical event",
      description:
        "I can compare how different people remembered or experienced the same event.",
      subject: "social_studies",
      gradeBand: "4",
      frameworkRefs: [{ framework: "C3", code: "D2.His.4.3-5" }],
      prerequisites: ["c3.3.D2.His.1"],
    },
    {
      id: "c3.4.D2.Geo.6",
      title: "Explain how geography shapes settlement",
      description:
        "I can explain why people settle near rivers, mountains, or coasts.",
      subject: "social_studies",
      gradeBand: "4",
      frameworkRefs: [{ framework: "C3", code: "D2.Geo.6.3-5" }],
      prerequisites: ["c3.3.D2.Geo.2"],
    },
    {
      id: "c3.4.D2.Eco.1",
      title: "Describe scarcity and choice",
      description:
        "I can explain why people can't have everything they want and how they decide.",
      subject: "social_studies",
      gradeBand: "4",
      frameworkRefs: [{ framework: "C3", code: "D2.Eco.1.3-5" }],
      prerequisites: [],
    },

    // ---- Grade 5: US history foundations ----
    {
      id: "c3.5.D2.His.3",
      title: "Order key events in early US history",
      description:
        "I can place major events from indigenous societies through the founding era on a timeline.",
      subject: "social_studies",
      gradeBand: "5",
      frameworkRefs: [{ framework: "C3", code: "D2.His.1.3-5" }],
      prerequisites: ["c3.4.D2.His.2"],
    },
    {
      id: "c3.5.D2.Civ.2",
      title: "Explain rights and responsibilities of citizens",
      description:
        "I can name rights citizens have and responsibilities they share, and give examples.",
      subject: "social_studies",
      gradeBand: "5",
      frameworkRefs: [{ framework: "C3", code: "D2.Civ.2.3-5" }],
      prerequisites: ["c3.3.D2.Civ.6"],
    },
    {
      id: "c3.5.D3.Src.1",
      title: "Evaluate sources for relevance and accuracy",
      description:
        "I can decide which sources help answer my question and which might be biased.",
      subject: "social_studies",
      gradeBand: "5",
      frameworkRefs: [{ framework: "C3", code: "D3.1.3-5" }],
      prerequisites: ["c3.3.D1.Q1"],
    },

    // ---- Grade 6: Ancient & classical civilizations ----
    {
      id: "c3.6.D2.His.2",
      title: "Analyze causes and effects in ancient societies",
      description:
        "I can explain why an ancient society rose or fell and what changed because of it.",
      subject: "social_studies",
      gradeBand: "6",
      frameworkRefs: [{ framework: "C3", code: "D2.His.14.6-8" }],
      prerequisites: ["c3.5.D2.His.3"],
    },
    {
      id: "c3.6.D2.Geo.4",
      title: "Use thematic maps to compare regions",
      description:
        "I can use climate, population, or resource maps to compare regions of the ancient world.",
      subject: "social_studies",
      gradeBand: "6",
      frameworkRefs: [{ framework: "C3", code: "D2.Geo.4.6-8" }],
      prerequisites: ["c3.4.D2.Geo.6"],
    },
    {
      id: "c3.6.D2.Eco.3",
      title: "Explain trade and exchange",
      description:
        "I can explain how trade spread goods, people, and ideas across ancient societies.",
      subject: "social_studies",
      gradeBand: "6",
      frameworkRefs: [{ framework: "C3", code: "D2.Eco.3.6-8" }],
      prerequisites: ["c3.4.D2.Eco.1"],
    },

    // ---- Grade 7: World history / world geography ----
    {
      id: "c3.7.D2.His.4",
      title: "Explain multiple causes of historical events",
      description:
        "I can identify several causes — political, economic, social — that led to a major change.",
      subject: "social_studies",
      gradeBand: "7",
      frameworkRefs: [{ framework: "C3", code: "D2.His.14.6-8" }],
      prerequisites: ["c3.6.D2.His.2"],
    },
    {
      id: "c3.7.D2.Geo.9",
      title: "Explain global interconnections",
      description:
        "I can explain how migration, trade, and conflict link distant places.",
      subject: "social_studies",
      gradeBand: "7",
      frameworkRefs: [{ framework: "C3", code: "D2.Geo.9.6-8" }],
      prerequisites: ["c3.6.D2.Geo.4"],
    },
    {
      id: "c3.7.D3.Src.2",
      title: "Corroborate evidence across sources",
      description:
        "I can compare two or more sources and explain where they agree and where they differ.",
      subject: "social_studies",
      gradeBand: "7",
      frameworkRefs: [{ framework: "C3", code: "D3.2.6-8" }],
      prerequisites: ["c3.5.D3.Src.1"],
    },

    // ---- Grade 8: US history (1763–present) ----
    {
      id: "c3.8.D2.His.5",
      title: "Analyze the founding documents",
      description:
        "I can explain the ideas in the Declaration, Constitution, and Bill of Rights using evidence.",
      subject: "social_studies",
      gradeBand: "8",
      frameworkRefs: [{ framework: "C3", code: "D2.His.5.6-8" }],
      prerequisites: ["c3.5.D2.Civ.2"],
    },
    {
      id: "c3.8.D2.Civ.4",
      title: "Explain how the branches of government check power",
      description:
        "I can explain how the legislative, executive, and judicial branches limit each other.",
      subject: "social_studies",
      gradeBand: "8",
      frameworkRefs: [{ framework: "C3", code: "D2.Civ.4.6-8" }],
      prerequisites: ["c3.5.D2.Civ.2"],
    },
    {
      id: "c3.8.D2.Eco.6",
      title: "Explain how markets allocate resources",
      description:
        "I can explain how prices and incentives guide what is produced and who gets it.",
      subject: "social_studies",
      gradeBand: "8",
      frameworkRefs: [{ framework: "C3", code: "D2.Eco.6.6-8" }],
      prerequisites: ["c3.6.D2.Eco.3"],
    },
    {
      id: "c3.8.D4.Com.2",
      title: "Construct an evidence-based argument",
      description:
        "I can build an argument about a historical question using evidence from multiple sources.",
      subject: "social_studies",
      gradeBand: "8",
      frameworkRefs: [{ framework: "C3", code: "D4.2.6-8" }],
      prerequisites: ["c3.7.D3.Src.2", "c3.7.D2.His.4"],
    },
  ],
};
