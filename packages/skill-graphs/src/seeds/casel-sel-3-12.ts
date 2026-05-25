import type { SkillGraph } from "../types.js";

/**
 * CASEL SEL Framework — Grades 3–12 expansion for Harmony.
 * Source: CASEL Framework for Social and Emotional Learning (2020).
 *
 * AI-DRAFT — anchored to the five CASEL competencies (Self-Awareness,
 * Self-Management, Social Awareness, Relationship Skills, Responsible
 * Decision-Making). NOT YET reviewed by a credentialed SEL specialist
 * or counselor; runtime should treat skills as `scaffold` (see
 * `harmony.coverageMatrix`) until SME sign-off. Trauma-adjacent
 * material requires extra review by the family-consent + safety teams.
 */
export const caselSel3To12: SkillGraph = {
  id: "casel-sel-3-12",
  title: "Social-Emotional Learning — Grades 3–12 (CASEL, AI-draft)",
  version: "0.1.0-draft",
  source: "CASEL Framework for Social and Emotional Learning (2020)",
  framework: "CASEL",
  subject: "sel",
  gradeBand: "3",
  skills: [
    // ---- Self-Awareness ----
    {
      id: "casel.sa.feelings.3",
      title: "Identify a range of emotions",
      description: "I can name many different feelings I have and notice them in my body.",
      subject: "sel",
      gradeBand: "3",
      frameworkRefs: [{ framework: "CASEL", code: "Self-Awareness" }],
      prerequisites: [],
    },
    {
      id: "casel.sa.strengths.6",
      title: "Identify personal strengths and growth areas",
      description: "I can name what I'm good at and what I'm working on.",
      subject: "sel",
      gradeBand: "6",
      frameworkRefs: [{ framework: "CASEL", code: "Self-Awareness" }],
      prerequisites: ["casel.sa.feelings.3"],
    },
    {
      id: "casel.sa.identity.9",
      title: "Examine personal and social identities",
      description: "I can examine the multiple identities I hold and how they shape my experience.",
      subject: "sel",
      gradeBand: "9",
      frameworkRefs: [{ framework: "CASEL", code: "Self-Awareness" }],
      prerequisites: ["casel.sa.strengths.6"],
    },

    // ---- Self-Management ----
    {
      id: "casel.sm.cope.4",
      title: "Use coping strategies for strong feelings",
      description: "I can use strategies like deep breaths to calm down when feelings are big.",
      subject: "sel",
      gradeBand: "4",
      frameworkRefs: [{ framework: "CASEL", code: "Self-Management" }],
      prerequisites: ["casel.sa.feelings.3"],
    },
    {
      id: "casel.sm.goals.7",
      title: "Set and pursue goals",
      description: "I can set a goal, break it into steps, and track my progress.",
      subject: "sel",
      gradeBand: "7",
      frameworkRefs: [{ framework: "CASEL", code: "Self-Management" }],
      prerequisites: ["casel.sa.strengths.6"],
    },
    {
      id: "casel.sm.stress.10",
      title: "Manage stress and seek support",
      description: "I can recognize when I'm stressed, use coping strategies, and ask for help when I need it.",
      subject: "sel",
      gradeBand: "10",
      frameworkRefs: [{ framework: "CASEL", code: "Self-Management" }],
      prerequisites: ["casel.sm.cope.4"],
    },

    // ---- Social Awareness ----
    {
      id: "casel.soa.empathy.5",
      title: "Show empathy and respect for others' perspectives",
      description: "I can imagine how others feel and respect their point of view.",
      subject: "sel",
      gradeBand: "5",
      frameworkRefs: [{ framework: "CASEL", code: "Social-Awareness" }],
      prerequisites: ["casel.sa.feelings.3"],
    },
    {
      id: "casel.soa.diversity.8",
      title: "Appreciate diversity and notice bias",
      description: "I can appreciate diverse perspectives and notice when bias is at play.",
      subject: "sel",
      gradeBand: "8",
      frameworkRefs: [{ framework: "CASEL", code: "Social-Awareness" }],
      prerequisites: ["casel.soa.empathy.5"],
    },
    {
      id: "casel.soa.systems.11",
      title: "Understand social and systemic influences",
      description: "I can analyze how social systems shape opportunities and outcomes.",
      subject: "sel",
      gradeBand: "11",
      frameworkRefs: [{ framework: "CASEL", code: "Social-Awareness" }],
      prerequisites: ["casel.soa.diversity.8", "casel.sa.identity.9"],
    },

    // ---- Relationship Skills ----
    {
      id: "casel.rs.communicate.4",
      title: "Communicate clearly and listen actively",
      description: "I can listen carefully and share my ideas so others can understand.",
      subject: "sel",
      gradeBand: "4",
      frameworkRefs: [{ framework: "CASEL", code: "Relationship-Skills" }],
      prerequisites: [],
    },
    {
      id: "casel.rs.conflict.7",
      title: "Resolve conflicts respectfully",
      description: "I can resolve a disagreement by listening, sharing, and finding a fair solution.",
      subject: "sel",
      gradeBand: "7",
      frameworkRefs: [{ framework: "CASEL", code: "Relationship-Skills" }],
      prerequisites: ["casel.rs.communicate.4"],
    },
    {
      id: "casel.rs.collab.10",
      title: "Collaborate effectively in diverse teams",
      description: "I can work effectively in a team with people who think differently from me.",
      subject: "sel",
      gradeBand: "10",
      frameworkRefs: [{ framework: "CASEL", code: "Relationship-Skills" }],
      prerequisites: ["casel.rs.conflict.7"],
    },

    // ---- Responsible Decision-Making ----
    {
      id: "casel.rdm.choices.5",
      title: "Make safe and ethical choices",
      description: "I can think about consequences before I make a choice that affects me and others.",
      subject: "sel",
      gradeBand: "5",
      frameworkRefs: [{ framework: "CASEL", code: "Responsible-Decision-Making" }],
      prerequisites: [],
    },
    {
      id: "casel.rdm.evaluate.9",
      title: "Evaluate options using evidence and values",
      description: "I can weigh choices using evidence, my values, and the impact on others.",
      subject: "sel",
      gradeBand: "9",
      frameworkRefs: [{ framework: "CASEL", code: "Responsible-Decision-Making" }],
      prerequisites: ["casel.rdm.choices.5"],
    },
    {
      id: "casel.rdm.civic.12",
      title: "Contribute to community well-being",
      description: "I can apply decision-making to issues that affect my community and act on them.",
      subject: "sel",
      gradeBand: "12",
      frameworkRefs: [{ framework: "CASEL", code: "Responsible-Decision-Making" }],
      prerequisites: ["casel.rdm.evaluate.9", "casel.soa.systems.11"],
    },
  ],
};
