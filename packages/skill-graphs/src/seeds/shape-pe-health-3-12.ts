import type { SkillGraph } from "../types.js";

/**
 * SHAPE America PE & Health — Grades 3–12 expansion for Vigor.
 * Source: SHAPE America National Standards & Grade-Level Outcomes for
 * K-12 Physical Education (2014) and National Health Education
 * Standards (NHES, 3rd ed., 2022).
 *
 * AI-DRAFT — anchored to SHAPE PE standards 1–5 (motor skills,
 * concepts/strategies, fitness, personal/social responsibility,
 * value of activity) and NHES standards 1–8 (health concepts,
 * influences, accessing info, communication, decision-making,
 * goal-setting, advocacy). NOT YET reviewed by a credentialed PE
 * or health educator; runtime should treat skills as `scaffold` (see
 * `vigor.coverageMatrix`) until SME sign-off. DAPE adaptations are
 * applied at session-plan time from the learner's `dape_profile`.
 */
export const shapePeHealth3To12: SkillGraph = {
  id: "shape-pe-health-3-12",
  title: "PE & Health — Grades 3–12 (SHAPE/NHES, AI-draft)",
  version: "0.1.0-draft",
  source: "SHAPE America PE National Standards (2014) + NHES (2022)",
  framework: "SHAPE",
  subject: "pe_health",
  gradeBand: "3",
  skills: [
    // ---- PE: Motor & movement ----
    {
      id: "shape.pe.s1.5",
      title: "Combine locomotor and manipulative skills",
      description: "I can combine running, jumping, and throwing into a smooth movement sequence.",
      subject: "pe_health",
      gradeBand: "5",
      frameworkRefs: [{ framework: "SHAPE", code: "PE S1.E1-26" }],
      prerequisites: [],
    },
    {
      id: "shape.pe.s2.8",
      title: "Apply concepts and strategies in games",
      description: "I can apply offensive and defensive strategies in modified game play.",
      subject: "pe_health",
      gradeBand: "8",
      frameworkRefs: [{ framework: "SHAPE", code: "PE S2.M1-12" }],
      prerequisites: ["shape.pe.s1.5"],
    },
    {
      id: "shape.pe.s2.12",
      title: "Analyze and apply tactics across activities",
      description:
        "I can analyze movement and apply tactics across a range of activities and lifetime sports.",
      subject: "pe_health",
      gradeBand: "12",
      frameworkRefs: [{ framework: "SHAPE", code: "PE S2.H1-3" }],
      prerequisites: ["shape.pe.s2.8"],
    },

    // ---- PE: Fitness ----
    {
      id: "shape.pe.s3.4",
      title: "Participate in fitness-related activity",
      description:
        "I can participate in activities that build my fitness and explain why each matters.",
      subject: "pe_health",
      gradeBand: "4",
      frameworkRefs: [{ framework: "SHAPE", code: "PE S3.E1-6" }],
      prerequisites: [],
    },
    {
      id: "shape.pe.s3.9",
      title: "Design a personal fitness plan",
      description:
        "I can design a personal fitness plan with goals, activities, and a way to track progress.",
      subject: "pe_health",
      gradeBand: "9",
      frameworkRefs: [{ framework: "SHAPE", code: "PE S3.H1-14" }],
      prerequisites: ["shape.pe.s3.4"],
    },
    {
      id: "shape.pe.s3.11",
      title: "Apply training principles to fitness",
      description:
        "I can apply training principles (FITT, overload, specificity) to my fitness plan.",
      subject: "pe_health",
      gradeBand: "11",
      frameworkRefs: [{ framework: "SHAPE", code: "PE S3.H7-9" }],
      prerequisites: ["shape.pe.s3.9"],
    },

    // ---- PE: Personal & social responsibility ----
    {
      id: "shape.pe.s4.6",
      title: "Demonstrate responsibility in physical activity",
      description:
        "I can take responsibility for my own behavior and follow safety procedures in activity.",
      subject: "pe_health",
      gradeBand: "6",
      frameworkRefs: [{ framework: "SHAPE", code: "PE S4.M1-7" }],
      prerequisites: [],
    },
    {
      id: "shape.pe.s4.10",
      title: "Lead and collaborate in activity settings",
      description: "I can lead, collaborate, and resolve conflicts in physical-activity settings.",
      subject: "pe_health",
      gradeBand: "10",
      frameworkRefs: [{ framework: "SHAPE", code: "PE S4.H1-5" }],
      prerequisites: ["shape.pe.s4.6"],
    },

    // ---- Health: Core concepts ----
    {
      id: "nhes.s1.5",
      title: "Describe relationships between behaviors and health",
      description: "I can describe how behaviors affect personal health.",
      subject: "pe_health",
      gradeBand: "5",
      frameworkRefs: [{ framework: "SHAPE", code: "NHES Std 1" }],
      prerequisites: [],
    },
    {
      id: "nhes.s2.8",
      title: "Analyze influences on health",
      description:
        "I can analyze how family, peers, culture, media, and technology influence health.",
      subject: "pe_health",
      gradeBand: "8",
      frameworkRefs: [{ framework: "SHAPE", code: "NHES Std 2" }],
      prerequisites: ["nhes.s1.5"],
    },
    {
      id: "nhes.s3.11",
      title: "Access valid health information and services",
      description: "I can access and evaluate valid health information, products, and services.",
      subject: "pe_health",
      gradeBand: "11",
      frameworkRefs: [{ framework: "SHAPE", code: "NHES Std 3" }],
      prerequisites: ["nhes.s2.8"],
    },
    {
      id: "nhes.s5.7",
      title: "Use a decision-making process for health",
      description: "I can use a decision-making process to make healthy choices.",
      subject: "pe_health",
      gradeBand: "7",
      frameworkRefs: [{ framework: "SHAPE", code: "NHES Std 5" }],
      prerequisites: ["nhes.s1.5"],
    },
    {
      id: "nhes.s6.9",
      title: "Set goals to enhance health",
      description: "I can set realistic health goals and track my progress toward them.",
      subject: "pe_health",
      gradeBand: "9",
      frameworkRefs: [{ framework: "SHAPE", code: "NHES Std 6" }],
      prerequisites: ["nhes.s5.7"],
    },
    {
      id: "nhes.s8.12",
      title: "Advocate for personal, family, and community health",
      description: "I can advocate for healthy choices for myself, my family, and my community.",
      subject: "pe_health",
      gradeBand: "12",
      frameworkRefs: [{ framework: "SHAPE", code: "NHES Std 8" }],
      prerequisites: ["nhes.s6.9"],
    },
  ],
};
