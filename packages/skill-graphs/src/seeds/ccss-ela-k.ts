import type { SkillGraph } from "../types.js";

/**
 * Common Core State Standards — English Language Arts, Kindergarten.
 * Source: http://www.corestandards.org/ELA-Literacy/ (2010, public domain).
 *
 * Starter seed for Sage. Covers Reading Foundational Skills (RF), a
 * Literature comprehension anchor (RL.K.1), and Writing-Opinion (W.K.1).
 * The full K–5 graph ships with the curriculum-content team's pack.
 */
export const ccssElaKindergarten: SkillGraph = {
  id: "ccss-ela-k",
  title: "English Language Arts — Kindergarten (CCSS-aligned)",
  version: "1.0.0",
  source: "Common Core State Standards for ELA, Kindergarten (2010)",
  framework: "CCSS-ELA",
  subject: "ela",
  gradeBand: "K",
  skills: [
    {
      id: "ccss-ela.K.RF.1",
      title: "Print concepts",
      description:
        "I can show how books and writing work — left to right, top to bottom, page by page.",
      subject: "ela",
      gradeBand: "K",
      frameworkRefs: [{ framework: "CCSS-ELA", code: "RF.K.1" }],
      prerequisites: [],
    },
    {
      id: "ccss-ela.K.RF.2",
      title: "Phonological awareness",
      description: "I can hear and play with sounds and syllables in spoken words.",
      subject: "ela",
      gradeBand: "K",
      frameworkRefs: [{ framework: "CCSS-ELA", code: "RF.K.2" }],
      prerequisites: [],
    },
    {
      id: "ccss-ela.K.RF.3",
      title: "Phonics and word recognition",
      description: "I can use letter-sound matches to read short words.",
      subject: "ela",
      gradeBand: "K",
      frameworkRefs: [{ framework: "CCSS-ELA", code: "RF.K.3" }],
      prerequisites: ["ccss-ela.K.RF.1", "ccss-ela.K.RF.2"],
    },
    {
      id: "ccss-ela.K.RL.1",
      title: "Ask and answer questions about a story",
      description: "I can ask and answer questions about important parts of a story.",
      subject: "ela",
      gradeBand: "K",
      frameworkRefs: [{ framework: "CCSS-ELA", code: "RL.K.1" }],
      prerequisites: ["ccss-ela.K.RF.1"],
    },
    {
      id: "ccss-ela.K.W.1",
      title: "Share an opinion in writing",
      description: "I can draw, dictate, or write to tell my opinion about a topic or book.",
      subject: "ela",
      gradeBand: "K",
      frameworkRefs: [{ framework: "CCSS-ELA", code: "W.K.1" }],
      prerequisites: ["ccss-ela.K.RF.3"],
    },
  ],
};
