import type { SkillGraph } from "../types.js";

/**
 * Life Skills & Executive Function — Grades 6+ starter slice for Compass.
 * Source: CEC (Council for Exceptional Children) Life Skills strand
 * + Indicator-13 transition planning anchors (IDEA 2004).
 *
 * Compass is gated to MIDDLE+HIGH tiers and activates the transition
 * planning module from age 14 forward (vocational interests, independent
 * living, community participation, self-advocacy).
 */
export const cecLifeSkills6Plus: SkillGraph = {
  id: "cec-life-skills-6-plus",
  title: "Life Skills & Executive Function — Grades 6+ (CEC-aligned)",
  version: "1.0.0",
  source: "CEC Life Skills + IDEA Indicator-13 Transition Anchors",
  framework: "CEC-LS",
  subject: "life_skills",
  gradeBand: "6",
  skills: [
    {
      id: "cec.ls.6.ef.plan",
      title: "Plan a multi-step task",
      description: "I can break a task into steps and put them in order.",
      subject: "life_skills",
      gradeBand: "6",
      frameworkRefs: [{ framework: "CEC-LS", code: "EF.Plan" }],
      prerequisites: [],
    },
    {
      id: "cec.ls.6.ef.time",
      title: "Use a schedule or timer",
      description: "I can read a visual schedule or use a timer to stay on task.",
      subject: "life_skills",
      gradeBand: "6",
      frameworkRefs: [{ framework: "CEC-LS", code: "EF.Time" }],
      prerequisites: ["cec.ls.6.ef.plan"],
    },
    {
      id: "cec.ls.6.daily.routine",
      title: "Follow a daily living routine",
      description: "I can follow steps for a daily routine like meals, hygiene, or chores.",
      subject: "life_skills",
      gradeBand: "6",
      frameworkRefs: [{ framework: "CEC-LS", code: "Daily.Living" }],
      prerequisites: ["cec.ls.6.ef.time"],
    },
    {
      id: "cec.ls.6.community.navigate",
      title: "Navigate a community setting",
      description: "I can follow steps to shop, ride transit, or visit a public place safely.",
      subject: "life_skills",
      gradeBand: "6",
      frameworkRefs: [{ framework: "CEC-LS", code: "Community.Participation" }],
      prerequisites: ["cec.ls.6.daily.routine"],
    },
    {
      id: "cec.ls.6.advocacy.request",
      title: "Use a self-advocacy script",
      description: "I can ask for help, state a preference, or decline using my words or AAC.",
      subject: "life_skills",
      gradeBand: "6",
      frameworkRefs: [{ framework: "CEC-LS", code: "Self.Advocacy" }],
      prerequisites: ["cec.ls.6.daily.routine"],
    },
  ],
};
