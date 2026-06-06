import type { SkillGraph } from "../types.js";

/**
 * CEC Life Skills & Transition Planning — Grades 9–12 + ADULT for Compass.
 * Source: CEC's Division on Career Development and Transition (DCDT)
 * transition-competency frameworks, Kohler's Taxonomy for Transition
 * Programming 2.0 (2016), and IDEA transition-planning indicators
 * (IDEA §300.43).
 *
 * AI-DRAFT — anchored to CEC/DCDT transition-competency domains
 * (Self-Determination, Employment, Post-Secondary Education,
 * Independent Living, Community Participation). NOT YET reviewed by a
 * credentialed transition specialist; runtime should treat skills as
 * `scaffold` quality (see `compass.coverageMatrix`) until SME sign-off.
 *
 * Extends `cec-life-skills-6-plus` from middle school into the HS
 * transition years and post-secondary ADULT band. Prerequisites are
 * within this graph.
 */
export const cecLifeSkills9To12: SkillGraph = {
  id: "cec-life-skills-9-12",
  title: "Life Skills & Transition — Grades 9–12 + ADULT (CEC/DCDT, AI-draft)",
  version: "1.0.0",
  source: "CEC DCDT Transition Competencies + Kohler's Taxonomy 2.0 + IDEA §300.43",
  framework: "CEC-LS",
  subject: "life_skills",
  gradeBand: "9",
  skills: [
    // ---- Self-Determination ----
    {
      id: "cec.ls.sd.goals.9",
      title: "Set and track personal transition goals",
      description: "I can set goals for after high school and track my progress toward them.",
      subject: "life_skills",
      gradeBand: "9",
      frameworkRefs: [{ framework: "CEC-LS", code: "DCDT/Self-Determination" }],
      prerequisites: [],
    },
    {
      id: "cec.ls.sd.advocate.10",
      title: "Self-advocate in IEP / planning meetings",
      description:
        "I can lead parts of my IEP or transition meeting, sharing my preferences and needs.",
      subject: "life_skills",
      gradeBand: "10",
      frameworkRefs: [{ framework: "CEC-LS", code: "DCDT/Self-Advocacy" }],
      prerequisites: ["cec.ls.sd.goals.9"],
    },

    // ---- Employment ----
    {
      id: "cec.ls.emp.explore.9",
      title: "Explore career interests and aptitudes",
      description:
        "I can use career inventories to explore jobs that match my interests and strengths.",
      subject: "life_skills",
      gradeBand: "9",
      frameworkRefs: [{ framework: "CEC-LS", code: "DCDT/Career-Exploration" }],
      prerequisites: [],
    },
    {
      id: "cec.ls.emp.resume.10",
      title: "Build a résumé and complete a job application",
      description: "I can write a résumé and complete a job application accurately.",
      subject: "life_skills",
      gradeBand: "10",
      frameworkRefs: [{ framework: "CEC-LS", code: "DCDT/Employment-Skills" }],
      prerequisites: ["cec.ls.emp.explore.9"],
    },
    {
      id: "cec.ls.emp.interview.11",
      title: "Prepare for and complete a job interview",
      description:
        "I can practice and complete a job interview, including following up afterwards.",
      subject: "life_skills",
      gradeBand: "11",
      frameworkRefs: [{ framework: "CEC-LS", code: "DCDT/Interview-Skills" }],
      prerequisites: ["cec.ls.emp.resume.10"],
    },
    {
      id: "cec.ls.emp.workplace.12",
      title: "Demonstrate workplace soft skills",
      description:
        "I can demonstrate punctuality, communication, and teamwork in a work or internship setting.",
      subject: "life_skills",
      gradeBand: "12",
      frameworkRefs: [{ framework: "CEC-LS", code: "DCDT/Workplace-Behaviors" }],
      prerequisites: ["cec.ls.emp.interview.11"],
    },

    // ---- Post-Secondary Education ----
    {
      id: "cec.ls.pse.research.10",
      title: "Research post-secondary options",
      description:
        "I can research colleges, trade schools, and training programs that fit my goals.",
      subject: "life_skills",
      gradeBand: "10",
      frameworkRefs: [{ framework: "CEC-LS", code: "DCDT/PSE-Planning" }],
      prerequisites: ["cec.ls.sd.goals.9"],
    },
    {
      id: "cec.ls.pse.apply.11",
      title: "Complete post-secondary applications and FAFSA",
      description:
        "I can complete applications and financial-aid forms with reasonable independence and supports.",
      subject: "life_skills",
      gradeBand: "11",
      frameworkRefs: [{ framework: "CEC-LS", code: "DCDT/PSE-Applications" }],
      prerequisites: ["cec.ls.pse.research.10"],
    },
    {
      id: "cec.ls.pse.accommodations.12",
      title: "Request disability accommodations in PSE",
      description:
        "I can request and document the accommodations I need at a college or workplace.",
      subject: "life_skills",
      gradeBand: "12",
      frameworkRefs: [{ framework: "CEC-LS", code: "DCDT/Accommodations" }],
      prerequisites: ["cec.ls.sd.advocate.10"],
    },

    // ---- Independent Living ----
    {
      id: "cec.ls.il.budget.10",
      title: "Manage a personal budget",
      description: "I can build and follow a basic personal budget, tracking income and expenses.",
      subject: "life_skills",
      gradeBand: "10",
      frameworkRefs: [{ framework: "CEC-LS", code: "DCDT/Financial-Literacy" }],
      prerequisites: [],
    },
    {
      id: "cec.ls.il.banking.11",
      title: "Use a bank account safely",
      description: "I can open and use a checking account, track balance, and avoid common scams.",
      subject: "life_skills",
      gradeBand: "11",
      frameworkRefs: [{ framework: "CEC-LS", code: "DCDT/Financial-Literacy" }],
      prerequisites: ["cec.ls.il.budget.10"],
    },
    {
      id: "cec.ls.il.housing.12",
      title: "Navigate housing and household management",
      description: "I can read a lease, plan utilities and chores, and manage a household routine.",
      subject: "life_skills",
      gradeBand: "12",
      frameworkRefs: [{ framework: "CEC-LS", code: "DCDT/Independent-Living" }],
      prerequisites: ["cec.ls.il.banking.11"],
    },
    {
      id: "cec.ls.il.healthcare.12",
      title: "Manage healthcare appointments and medications",
      description:
        "I can schedule appointments, communicate with providers, and follow a medication routine.",
      subject: "life_skills",
      gradeBand: "12",
      frameworkRefs: [{ framework: "CEC-LS", code: "DCDT/Health-Self-Mgmt" }],
      prerequisites: [],
    },

    // ---- Community Participation ----
    {
      id: "cec.ls.cp.transport.11",
      title: "Use public or accessible transportation",
      description:
        "I can plan a route using public or accessible transportation to get to a destination.",
      subject: "life_skills",
      gradeBand: "11",
      frameworkRefs: [{ framework: "CEC-LS", code: "DCDT/Community-Participation" }],
      prerequisites: [],
    },
    {
      id: "cec.ls.cp.civic.12",
      title: "Participate in civic life",
      description:
        "I can register to vote, contact elected representatives, and join community organizations.",
      subject: "life_skills",
      gradeBand: "12",
      frameworkRefs: [{ framework: "CEC-LS", code: "DCDT/Civic-Participation" }],
      prerequisites: ["cec.ls.sd.advocate.10"],
    },

    // ---- ADULT — post-secondary maintenance ----
    {
      id: "cec.ls.adult.maintain",
      title: "Maintain independent living routines",
      description:
        "I can maintain my budget, housing, healthcare, and social connections as an adult.",
      subject: "life_skills",
      gradeBand: "ADULT",
      frameworkRefs: [{ framework: "CEC-LS", code: "DCDT/Adult-Outcomes" }],
      prerequisites: ["cec.ls.il.housing.12", "cec.ls.il.healthcare.12"],
    },
    {
      id: "cec.ls.adult.career",
      title: "Advance a career or further education",
      description:
        "I can pursue raises, promotions, certifications, or further education to advance my goals.",
      subject: "life_skills",
      gradeBand: "ADULT",
      frameworkRefs: [{ framework: "CEC-LS", code: "DCDT/Career-Advancement" }],
      prerequisites: ["cec.ls.emp.workplace.12"],
    },
  ],
};
