import type { SkillGraph } from "../types.js";

/**
 * ASHA School-Age Speech & Language — Grades 3–8 expansion for Echo.
 * Source: ASHA "School-Age Language Development" and "Speech Sound
 * Disorders" practice portal (publicly published guidance, 2023).
 *
 * AI-DRAFT — anchored to ASHA's published school-age language and
 * articulation domains (semantic, syntactic, pragmatic, phonological,
 * fluency). NOT YET reviewed by a credentialed SLP; runtime should
 * treat skills as `scaffold` quality (see `echo.coverageMatrix`) until
 * SME sign-off.
 *
 * Skills lean on "I can..." learner-facing language but the underlying
 * targets are clinician-defined (e.g. multisyllabic word production,
 * narrative cohesion). Prerequisites are within this graph and ladder
 * from the K-2 ASHA early-childhood graph in spirit (cross-graph refs
 * would fail validateGraph).
 */
export const ashaSpeechSchoolAge: SkillGraph = {
  id: "asha-speech-school-age",
  title: "Speech & Language — Grades 3–8 (ASHA school-age, AI-draft)",
  version: "1.0.0",
  source: "ASHA Practice Portal — School-Age Language Development & Speech Sound Disorders",
  framework: "ASHA",
  subject: "speech",
  gradeBand: "3",
  skills: [
    // ---- Articulation / phonological ----
    {
      id: "asha.school.art.multi",
      title: "Produce multisyllabic words accurately",
      description:
        "I can say long words with many syllables clearly, like 'refrigerator' or 'vocabulary'.",
      subject: "speech",
      gradeBand: "3",
      frameworkRefs: [{ framework: "ASHA", code: "SSD/School-Age/Articulation" }],
      prerequisites: [],
    },
    {
      id: "asha.school.art.connected",
      title: "Maintain clear speech in connected discourse",
      description:
        "I can keep my speech sounds clear when I'm talking in long sentences or telling a story.",
      subject: "speech",
      gradeBand: "4",
      frameworkRefs: [{ framework: "ASHA", code: "SSD/Conversational" }],
      prerequisites: ["asha.school.art.multi"],
    },

    // ---- Semantics ----
    {
      id: "asha.school.sem.word",
      title: "Use academic vocabulary in context",
      description:
        "I can use new academic words I learn in subjects like science and history when I talk or write.",
      subject: "speech",
      gradeBand: "4",
      frameworkRefs: [{ framework: "ASHA", code: "SAL/Semantic" }],
      prerequisites: [],
    },
    {
      id: "asha.school.sem.figurative",
      title: "Understand and use figurative language",
      description: "I can understand idioms, similes, and metaphors and use them when appropriate.",
      subject: "speech",
      gradeBand: "5",
      frameworkRefs: [{ framework: "ASHA", code: "SAL/Semantic" }],
      prerequisites: ["asha.school.sem.word"],
    },

    // ---- Syntax / morphology ----
    {
      id: "asha.school.syn.complex",
      title: "Use complex sentences with subordinate clauses",
      description:
        "I can combine ideas using words like 'because', 'although', and 'while' to make complex sentences.",
      subject: "speech",
      gradeBand: "5",
      frameworkRefs: [{ framework: "ASHA", code: "SAL/Syntactic" }],
      prerequisites: [],
    },
    {
      id: "asha.school.syn.cohesion",
      title: "Use cohesive devices in extended discourse",
      description:
        "I can connect my ideas across sentences using pronouns, conjunctions, and transition words.",
      subject: "speech",
      gradeBand: "6",
      frameworkRefs: [{ framework: "ASHA", code: "SAL/Discourse" }],
      prerequisites: ["asha.school.syn.complex"],
    },

    // ---- Pragmatics ----
    {
      id: "asha.school.prag.repair",
      title: "Repair communication breakdowns",
      description:
        "I can notice when someone doesn't understand me and try a different way to explain.",
      subject: "speech",
      gradeBand: "3",
      frameworkRefs: [{ framework: "ASHA", code: "SAL/Pragmatic" }],
      prerequisites: [],
    },
    {
      id: "asha.school.prag.persp",
      title: "Take a listener's perspective",
      description:
        "I can adjust what and how I say things based on who is listening and what they already know.",
      subject: "speech",
      gradeBand: "6",
      frameworkRefs: [{ framework: "ASHA", code: "SAL/Pragmatic" }],
      prerequisites: ["asha.school.prag.repair"],
    },
    {
      id: "asha.school.prag.persuade",
      title: "Use persuasive and informative discourse",
      description: "I can structure what I say to inform or persuade a listener.",
      subject: "speech",
      gradeBand: "7",
      frameworkRefs: [{ framework: "ASHA", code: "SAL/Pragmatic" }],
      prerequisites: ["asha.school.prag.persp"],
    },

    // ---- Narrative / expository discourse ----
    {
      id: "asha.school.narr.story",
      title: "Tell a coherent personal narrative",
      description:
        "I can tell a story about something that happened to me with a beginning, middle, and end.",
      subject: "speech",
      gradeBand: "3",
      frameworkRefs: [{ framework: "ASHA", code: "SAL/Narrative" }],
      prerequisites: [],
    },
    {
      id: "asha.school.narr.expos",
      title: "Produce expository (explaining) discourse",
      description:
        "I can explain how something works or why something happens using organized speech.",
      subject: "speech",
      gradeBand: "7",
      frameworkRefs: [{ framework: "ASHA", code: "SAL/Expository" }],
      prerequisites: ["asha.school.narr.story", "asha.school.syn.cohesion"],
    },

    // ---- Fluency / voice ----
    {
      id: "asha.school.flu.strategy",
      title: "Apply fluency-enhancing strategies",
      description:
        "I can use strategies like easy onset or light contact to speak more smoothly when I need to.",
      subject: "speech",
      gradeBand: "5",
      frameworkRefs: [{ framework: "ASHA", code: "Fluency/School-Age" }],
      prerequisites: [],
    },

    // ---- AAC / supported communication ----
    {
      id: "asha.school.aac.acad",
      title: "Use AAC for academic discussion",
      description:
        "I can use my communication device to answer questions and share ideas in class.",
      subject: "speech",
      gradeBand: "4",
      frameworkRefs: [{ framework: "ASHA", code: "AAC/School-Age" }],
      prerequisites: [],
    },
    {
      id: "asha.school.aac.peer",
      title: "Use AAC in peer conversations",
      description:
        "I can use my communication device to start and keep a conversation going with classmates.",
      subject: "speech",
      gradeBand: "6",
      frameworkRefs: [{ framework: "ASHA", code: "AAC/Social" }],
      prerequisites: ["asha.school.aac.acad"],
    },
    {
      id: "asha.school.advocacy",
      title: "Self-advocate for communication needs",
      description: "I can tell teachers and peers what helps me communicate best.",
      subject: "speech",
      gradeBand: "8",
      frameworkRefs: [{ framework: "ASHA", code: "Self-Advocacy" }],
      prerequisites: ["asha.school.prag.persp"],
    },
  ],
};
