import type { SkillGraph } from "../types.js";

/**
 * NCAS Music — Grades 3–8 expansion for Cadence.
 * Source: National Core Arts Standards (NCAS) — Music (2014, NAfME).
 *
 * AI-DRAFT — anchored to NCAS Music artistic processes (Create,
 * Perform, Respond, Connect) at the elementary (3–5) and middle (6–8)
 * proficiency levels. NOT YET reviewed by a credentialed music
 * educator; runtime should treat skills as `scaffold` quality (see
 * `cadence.coverageMatrix`) until SME sign-off.
 *
 * NCAS Music codes use the form `MU:Cr1.1.E.5a` (Music: Create
 * anchor 1, enduring understanding 1, elementary, grade 5, indicator a).
 * Skills below capture the spine — performance, composition,
 * listening / response, cultural connection — across grades 3–8.
 */
export const ncasMusic3To8: SkillGraph = {
  id: "ncas-music-3-8",
  title: "Music — Grades 3–8 (NCAS, AI-draft)",
  version: "1.0.0",
  source: "National Core Arts Standards — Music (NAfME 2014), grades 3–8",
  framework: "NCAS",
  subject: "music",
  gradeBand: "3",
  skills: [
    // ---- Create ----
    {
      id: "ncas.music.cr1.3",
      title: "Improvise rhythmic and melodic patterns",
      description: "I can make up short rhythm or melody patterns to express an idea.",
      subject: "music",
      gradeBand: "3",
      frameworkRefs: [{ framework: "NCAS", code: "MU:Cr1.1.E.3a" }],
      prerequisites: [],
    },
    {
      id: "ncas.music.cr2.5",
      title: "Compose and arrange a short piece",
      description:
        "I can compose a short piece using rhythm, melody, and dynamics that fit my idea.",
      subject: "music",
      gradeBand: "5",
      frameworkRefs: [{ framework: "NCAS", code: "MU:Cr2.1.E.5a" }],
      prerequisites: ["ncas.music.cr1.3"],
    },
    {
      id: "ncas.music.cr3.7",
      title: "Refine compositions with peer feedback",
      description: "I can revise a piece I composed based on feedback to make it stronger.",
      subject: "music",
      gradeBand: "7",
      frameworkRefs: [{ framework: "NCAS", code: "MU:Cr3.1.E.7a" }],
      prerequisites: ["ncas.music.cr2.5"],
    },

    // ---- Perform ----
    {
      id: "ncas.music.pr4.3",
      title: "Read simple rhythmic and melodic notation",
      description:
        "I can read basic notation (quarter, eighth, half notes and a five-note scale) to perform a piece.",
      subject: "music",
      gradeBand: "3",
      frameworkRefs: [{ framework: "NCAS", code: "MU:Pr4.2.E.3a" }],
      prerequisites: [],
    },
    {
      id: "ncas.music.pr5.5",
      title: "Rehearse to improve performance",
      description:
        "I can rehearse a piece, focusing on accuracy, expression, and following the conductor.",
      subject: "music",
      gradeBand: "5",
      frameworkRefs: [{ framework: "NCAS", code: "MU:Pr5.1.E.5a" }],
      prerequisites: ["ncas.music.pr4.3"],
    },
    {
      id: "ncas.music.pr6.8",
      title: "Perform with technical accuracy and expression",
      description:
        "I can perform alone or with a group with accurate pitch, rhythm, and expressive choices.",
      subject: "music",
      gradeBand: "8",
      frameworkRefs: [{ framework: "NCAS", code: "MU:Pr6.1.E.8a" }],
      prerequisites: ["ncas.music.pr5.5"],
    },

    // ---- Respond ----
    {
      id: "ncas.music.re7.4",
      title: "Describe music using elements and vocabulary",
      description: "I can describe a piece of music using terms like tempo, dynamics, and timbre.",
      subject: "music",
      gradeBand: "4",
      frameworkRefs: [{ framework: "NCAS", code: "MU:Re7.2.E.4a" }],
      prerequisites: [],
    },
    {
      id: "ncas.music.re8.6",
      title: "Interpret expressive intent in a piece",
      description:
        "I can explain how a composer or performer uses musical elements to create meaning.",
      subject: "music",
      gradeBand: "6",
      frameworkRefs: [{ framework: "NCAS", code: "MU:Re8.1.E.6a" }],
      prerequisites: ["ncas.music.re7.4"],
    },
    {
      id: "ncas.music.re9.8",
      title: "Evaluate musical works using criteria",
      description: "I can evaluate a musical work using personal and established criteria.",
      subject: "music",
      gradeBand: "8",
      frameworkRefs: [{ framework: "NCAS", code: "MU:Re9.1.E.8a" }],
      prerequisites: ["ncas.music.re8.6"],
    },

    // ---- Connect ----
    {
      id: "ncas.music.cn10.5",
      title: "Connect music to personal experience",
      description: "I can explain how a piece of music connects to my own experiences or feelings.",
      subject: "music",
      gradeBand: "5",
      frameworkRefs: [{ framework: "NCAS", code: "MU:Cn10.0.E.5a" }],
      prerequisites: ["ncas.music.re7.4"],
    },
    {
      id: "ncas.music.cn11.7",
      title: "Connect music to culture and context",
      description: "I can explain how music reflects the time, place, and culture it comes from.",
      subject: "music",
      gradeBand: "7",
      frameworkRefs: [{ framework: "NCAS", code: "MU:Cn11.0.E.7a" }],
      prerequisites: ["ncas.music.cn10.5"],
    },
  ],
};
