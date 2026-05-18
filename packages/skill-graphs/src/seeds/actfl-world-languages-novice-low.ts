import type { SkillGraph } from "../types.js";

/**
 * ACTFL World-Readiness Standards & Novice-Low (NL) starter slice for
 * Lingua. Anchored to the 5 C's (Communication, Cultures, Connections,
 * Comparisons, Communities).
 * Source: ACTFL World-Readiness Standards for Learning Languages (2015)
 * + ACTFL Performance Descriptors.
 *
 * Grade-band is set to "6" — Lingua's tutor catalog gates this tutor to
 * MIDDLE+HIGH tiers. Lower-tier exposure flows through the home-language
 * scaffolding inside Sage / Atlas instead.
 */
export const actflWorldLanguagesNoviceLow: SkillGraph = {
  id: "actfl-world-languages-novice-low",
  title: "World Languages — Novice Low (ACTFL-aligned)",
  version: "1.0.0",
  source: "ACTFL World-Readiness Standards for Learning Languages (2015)",
  framework: "ACTFL",
  subject: "world_languages",
  gradeBand: "6",
  skills: [
    {
      id: "actfl.nl.com.greet",
      title: "Greet and introduce yourself",
      description: "I can greet someone and say my name in the target language.",
      subject: "world_languages",
      gradeBand: "6",
      frameworkRefs: [{ framework: "ACTFL", code: "NL Interpersonal" }],
      prerequisites: [],
    },
    {
      id: "actfl.nl.com.ask",
      title: "Ask and answer simple questions",
      description: "I can ask and answer questions about name, age, where I live.",
      subject: "world_languages",
      gradeBand: "6",
      frameworkRefs: [{ framework: "ACTFL", code: "NL Interpersonal" }],
      prerequisites: ["actfl.nl.com.greet"],
    },
    {
      id: "actfl.nl.interp.menu",
      title: "Recognize familiar words on a menu or sign",
      description: "I can find familiar words on a menu, sign, or schedule.",
      subject: "world_languages",
      gradeBand: "6",
      frameworkRefs: [{ framework: "ACTFL", code: "NL Interpretive Reading" }],
      prerequisites: ["actfl.nl.com.greet"],
    },
    {
      id: "actfl.nl.cultures.product",
      title: "Identify a cultural product or practice",
      description: "I can name a food, song, or holiday from a target-language culture.",
      subject: "world_languages",
      gradeBand: "6",
      frameworkRefs: [{ framework: "ACTFL", code: "Cultures" }],
      prerequisites: [],
    },
    {
      id: "actfl.nl.compare.languages",
      title: "Compare a feature with my home language",
      description:
        "I can show one way the new language is the same as or different from my home language.",
      subject: "world_languages",
      gradeBand: "6",
      frameworkRefs: [{ framework: "ACTFL", code: "Comparisons" }],
      prerequisites: ["actfl.nl.com.ask", "actfl.nl.cultures.product"],
    },
  ],
};
