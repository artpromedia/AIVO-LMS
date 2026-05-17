import type { SkillGraph } from "../types.js";

/**
 * Speech & Language starter graph for Echo.
 * Source: ASHA developmental milestones for Speech-Language Pathology
 * (American Speech-Language-Hearing Association).
 *
 * Echo overlaps Speech Buddy's clinical core — this graph covers the
 * cross-tutor speech-and-language skills (articulation, vocabulary,
 * conversation, AAC) that are routed through the generic runtime when
 * Speech Buddy's full audio stack is not engaged.
 */
export const ashaSpeechEarly: SkillGraph = {
  id: "asha-speech-early",
  title: "Speech & Language — Early Childhood (ASHA-aligned)",
  version: "1.0.0",
  source: "ASHA Developmental Norms for Speech & Language (2021)",
  framework: "ASHA",
  subject: "speech",
  gradeBand: "PRE_K",
  skills: [
    {
      id: "asha.early.artic.initial",
      title: "Produce target initial sounds",
      description: "I can say target sounds at the start of a word with a model.",
      subject: "speech",
      gradeBand: "PRE_K",
      frameworkRefs: [{ framework: "ASHA", code: "Articulation/Initial" }],
      prerequisites: [],
    },
    {
      id: "asha.early.vocab.core",
      title: "Use a core vocabulary set",
      description: "I can use a small set of go-to words and signs across activities.",
      subject: "speech",
      gradeBand: "PRE_K",
      frameworkRefs: [{ framework: "ASHA", code: "Receptive/Expressive Vocabulary" }],
      prerequisites: [],
    },
    {
      id: "asha.early.aac.request",
      title: "Request items via AAC",
      description: "I can use a symbol, picture, or device to ask for something I want.",
      subject: "speech",
      gradeBand: "PRE_K",
      frameworkRefs: [{ framework: "ASHA", code: "AAC/Request" }],
      prerequisites: ["asha.early.vocab.core"],
    },
    {
      id: "asha.early.convo.turn",
      title: "Take a turn in a short conversation",
      description: "I can take one turn back and forth with a partner.",
      subject: "speech",
      gradeBand: "PRE_K",
      frameworkRefs: [{ framework: "ASHA", code: "Pragmatics/Turn-Taking" }],
      prerequisites: ["asha.early.vocab.core"],
    },
    {
      id: "asha.early.narrate.event",
      title: "Tell what happened today",
      description: "I can tell or sign one thing that happened today, in order.",
      subject: "speech",
      gradeBand: "PRE_K",
      frameworkRefs: [{ framework: "ASHA", code: "Narrative/Recount" }],
      prerequisites: ["asha.early.convo.turn"],
    },
  ],
};
