import type { SkillGraph } from "../types.js";

/**
 * ACTFL World Languages — Novice-Mid through Intermediate-Mid (Grades 7–12).
 * Source: ACTFL World-Readiness Standards & Performance Descriptors (2017).
 *
 * AI-DRAFT — anchored to ACTFL proficiency descriptors across
 * Interpretive, Interpersonal, and Presentational modes, plus the
 * 5 Cs (Communication, Cultures, Connections, Comparisons,
 * Communities). NOT YET reviewed by a credentialed world-languages
 * curriculum designer; runtime should treat skills as `scaffold`
 * quality (see `lingua.coverageMatrix`) until SME sign-off.
 *
 * This graph picks up where `actfl-world-languages-novice-low` ends
 * (grade 6) and ladders learners through Novice-Mid, Novice-High,
 * and Intermediate-Low/Mid. Target-language and home-language are
 * resolved at session-start from the LearnerContext; codes here use
 * mode + proficiency tier as the framework identifier.
 */
export const actflWorldLanguages7To12: SkillGraph = {
  id: "actfl-world-languages-7-12",
  title: "World Languages — Grades 7–12 (ACTFL Novice-Mid → Intermediate-Mid, AI-draft)",
  version: "0.1.0-draft",
  source: "ACTFL World-Readiness Standards & Performance Descriptors (2017)",
  framework: "ACTFL",
  subject: "world_languages",
  gradeBand: "7",
  skills: [
    // ---- Novice-Mid (grade 7) ----
    {
      id: "actfl.nm.interp.7",
      title: "Understand short familiar phrases (Novice-Mid)",
      description:
        "I can understand simple words and phrases about familiar topics when I read or hear them.",
      subject: "world_languages",
      gradeBand: "7",
      frameworkRefs: [{ framework: "ACTFL", code: "Interpretive/Novice-Mid" }],
      prerequisites: [],
    },
    {
      id: "actfl.nm.inters.7",
      title: "Communicate with memorized expressions (Novice-Mid)",
      description:
        "I can ask and answer simple questions using memorized words and phrases.",
      subject: "world_languages",
      gradeBand: "7",
      frameworkRefs: [{ framework: "ACTFL", code: "Interpersonal/Novice-Mid" }],
      prerequisites: [],
    },
    {
      id: "actfl.nm.present.7",
      title: "Present information using memorized phrases",
      description:
        "I can introduce myself and describe familiar things using memorized phrases.",
      subject: "world_languages",
      gradeBand: "7",
      frameworkRefs: [{ framework: "ACTFL", code: "Presentational/Novice-Mid" }],
      prerequisites: ["actfl.nm.inters.7"],
    },

    // ---- Novice-High (grade 8–9) ----
    {
      id: "actfl.nh.interp.8",
      title: "Understand main idea of simple texts (Novice-High)",
      description:
        "I can understand the main idea of a short, simple text on a familiar topic.",
      subject: "world_languages",
      gradeBand: "8",
      frameworkRefs: [{ framework: "ACTFL", code: "Interpretive/Novice-High" }],
      prerequisites: ["actfl.nm.interp.7"],
    },
    {
      id: "actfl.nh.inters.9",
      title: "Exchange simple information (Novice-High)",
      description:
        "I can exchange simple information about familiar topics with short conversations.",
      subject: "world_languages",
      gradeBand: "9",
      frameworkRefs: [{ framework: "ACTFL", code: "Interpersonal/Novice-High" }],
      prerequisites: ["actfl.nm.inters.7"],
    },

    // ---- Intermediate-Low (grade 9–10) ----
    {
      id: "actfl.il.interp.10",
      title: "Understand main idea in short connected texts",
      description:
        "I can understand the main idea and some details of a short text or conversation on a familiar topic.",
      subject: "world_languages",
      gradeBand: "10",
      frameworkRefs: [{ framework: "ACTFL", code: "Interpretive/Intermediate-Low" }],
      prerequisites: ["actfl.nh.interp.8"],
    },
    {
      id: "actfl.il.inters.10",
      title: "Sustain a simple conversation",
      description:
        "I can sustain a simple conversation with someone willing to help me, on familiar topics.",
      subject: "world_languages",
      gradeBand: "10",
      frameworkRefs: [{ framework: "ACTFL", code: "Interpersonal/Intermediate-Low" }],
      prerequisites: ["actfl.nh.inters.9"],
    },
    {
      id: "actfl.il.present.10",
      title: "Present using simple connected sentences",
      description:
        "I can present information about familiar topics using simple connected sentences.",
      subject: "world_languages",
      gradeBand: "10",
      frameworkRefs: [{ framework: "ACTFL", code: "Presentational/Intermediate-Low" }],
      prerequisites: ["actfl.nm.present.7"],
    },

    // ---- Intermediate-Mid (grade 11–12) ----
    {
      id: "actfl.im.interp.11",
      title: "Understand connected discourse on familiar topics",
      description:
        "I can understand connected discourse on familiar topics, including some unfamiliar vocabulary in context.",
      subject: "world_languages",
      gradeBand: "11",
      frameworkRefs: [{ framework: "ACTFL", code: "Interpretive/Intermediate-Mid" }],
      prerequisites: ["actfl.il.interp.10"],
    },
    {
      id: "actfl.im.inters.11",
      title: "Handle uncomplicated communicative tasks",
      description:
        "I can handle short, uncomplicated tasks and social situations in the target language.",
      subject: "world_languages",
      gradeBand: "11",
      frameworkRefs: [{ framework: "ACTFL", code: "Interpersonal/Intermediate-Mid" }],
      prerequisites: ["actfl.il.inters.10"],
    },
    {
      id: "actfl.im.present.12",
      title: "Present on familiar topics with detail",
      description:
        "I can present on familiar topics with some detail and connected sentences.",
      subject: "world_languages",
      gradeBand: "12",
      frameworkRefs: [{ framework: "ACTFL", code: "Presentational/Intermediate-Mid" }],
      prerequisites: ["actfl.il.present.10"],
    },

    // ---- Cultures, Connections, Comparisons, Communities ----
    {
      id: "actfl.cultures.9",
      title: "Investigate cultural practices and perspectives",
      description:
        "I can investigate the relationship between cultural practices and the perspectives of a target culture.",
      subject: "world_languages",
      gradeBand: "9",
      frameworkRefs: [{ framework: "ACTFL", code: "Cultures/Standard 2.1" }],
      prerequisites: [],
    },
    {
      id: "actfl.connections.11",
      title: "Use the target language to access other disciplines",
      description:
        "I can use the target language to learn about a topic from another subject area.",
      subject: "world_languages",
      gradeBand: "11",
      frameworkRefs: [{ framework: "ACTFL", code: "Connections/Standard 3.1" }],
      prerequisites: ["actfl.im.interp.11"],
    },
    {
      id: "actfl.communities.12",
      title: "Participate in target-language communities",
      description:
        "I can interact with target-language communities at home or beyond school to share knowledge.",
      subject: "world_languages",
      gradeBand: "12",
      frameworkRefs: [{ framework: "ACTFL", code: "Communities/Standard 5.1" }],
      prerequisites: ["actfl.im.inters.11"],
    },
  ],
};
