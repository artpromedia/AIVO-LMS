import type { SkillGraph } from "../types.js";

/**
 * CASEL 5 — Social-Emotional Learning starter graph for Harmony.
 * Source: CASEL (Collaborative for Academic, Social, and Emotional
 * Learning) Framework, 2020 update.
 *
 * One skill per CASEL competency: Self-Awareness, Self-Management,
 * Social Awareness, Relationship Skills, Responsible Decision-Making.
 * Grade-banded examples are introduced through the K–2 lens.
 */
export const caselSelK2: SkillGraph = {
  id: "casel-sel-k2",
  title: "Social-Emotional Learning — Grades K–2 (CASEL 5)",
  version: "1.0.0",
  source: "CASEL Framework — 5 SEL Competencies (2020)",
  framework: "CASEL",
  subject: "sel",
  gradeBand: "K",
  skills: [
    {
      id: "casel.k2.self_awareness.feelings",
      title: "Name feelings in myself",
      description: "I can name how I feel using words or pictures.",
      subject: "sel",
      gradeBand: "K",
      frameworkRefs: [{ framework: "CASEL", code: "Self-Awareness" }],
      prerequisites: [],
    },
    {
      id: "casel.k2.self_management.calm",
      title: "Use a calm-down strategy",
      description: "I can pick a strategy (deep breath, count, take a break) when I feel big feelings.",
      subject: "sel",
      gradeBand: "K",
      frameworkRefs: [{ framework: "CASEL", code: "Self-Management" }],
      prerequisites: ["casel.k2.self_awareness.feelings"],
    },
    {
      id: "casel.k2.social_awareness.perspective",
      title: "Notice how someone else feels",
      description: "I can look at a face or a story and tell how a friend feels.",
      subject: "sel",
      gradeBand: "K",
      frameworkRefs: [{ framework: "CASEL", code: "Social Awareness" }],
      prerequisites: ["casel.k2.self_awareness.feelings"],
    },
    {
      id: "casel.k2.relationship.share",
      title: "Take turns and share",
      description: "I can take turns and share with a partner during play.",
      subject: "sel",
      gradeBand: "K",
      frameworkRefs: [{ framework: "CASEL", code: "Relationship Skills" }],
      prerequisites: ["casel.k2.social_awareness.perspective"],
    },
    {
      id: "casel.k2.decision.safe",
      title: "Choose a safe and kind option",
      description: "I can stop and pick a choice that is safe and kind.",
      subject: "sel",
      gradeBand: "K",
      frameworkRefs: [{ framework: "CASEL", code: "Responsible Decision-Making" }],
      prerequisites: ["casel.k2.self_management.calm", "casel.k2.relationship.share"],
    },
  ],
};
