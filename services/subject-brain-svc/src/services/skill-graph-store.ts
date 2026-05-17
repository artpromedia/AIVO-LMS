import type { Subject } from "./types.js";

export interface SkillNode {
  code: string;
  label: string;
  subject: Subject;
  prerequisites: string[];
  topicKeywords: string[];
  standards: string[];
}

const SKILL_NODES: SkillNode[] = [
  // Math
  {
    code: "MATH.NUM.COUNT",
    label: "Counting and number sense",
    subject: "math",
    prerequisites: [],
    topicKeywords: ["count", "number sense", "numbers"],
    standards: ["CCSS.K.CC"],
  },
  {
    code: "MATH.ARITH.ADD_SUB",
    label: "Addition and subtraction",
    subject: "math",
    prerequisites: ["MATH.NUM.COUNT"],
    topicKeywords: ["add", "subtract", "arithmetic"],
    standards: ["CCSS.1.OA"],
  },
  {
    code: "MATH.GEOM.AREA",
    label: "Area of rectangles",
    subject: "math",
    prerequisites: ["MATH.ARITH.ADD_SUB"],
    topicKeywords: ["area", "rectangle"],
    standards: ["CCSS.3.MD.C.7"],
  },
  {
    code: "MATH.GEOM.PERIMETER",
    label: "Perimeter of polygons",
    subject: "math",
    prerequisites: ["MATH.ARITH.ADD_SUB"],
    topicKeywords: ["perimeter"],
    standards: ["CCSS.3.MD.D.8"],
  },
  {
    code: "MATH.FRACTIONS",
    label: "Fractions and parts of wholes",
    subject: "math",
    prerequisites: ["MATH.ARITH.ADD_SUB"],
    topicKeywords: ["fraction", "halves", "thirds", "quarters"],
    standards: ["CCSS.3.NF"],
  },

  // Science
  {
    code: "SCI.CLASS.LIVING",
    label: "Classifying living things",
    subject: "science",
    prerequisites: [],
    topicKeywords: ["classification", "classify", "living", "mammals", "birds"],
    standards: ["NGSS.3-LS"],
  },
  {
    code: "SCI.CYCLE.WATER",
    label: "Water cycle sequencing",
    subject: "science",
    prerequisites: [],
    topicKeywords: ["water cycle", "evaporation", "condensation", "precipitation"],
    standards: ["NGSS.5-ESS2"],
  },
  {
    code: "SCI.OBSERVE_INFER",
    label: "Observation vs inference",
    subject: "science",
    prerequisites: [],
    topicKeywords: ["observe", "inference", "evidence"],
    standards: ["NGSS.3-5-ETS1"],
  },

  // ELA
  {
    code: "ELA.READ.COMPREHEND",
    label: "Reading comprehension",
    subject: "ela",
    prerequisites: [],
    topicKeywords: ["read", "comprehension", "passage"],
    standards: ["CCSS.ELA.RL"],
  },
  {
    code: "ELA.VOCAB",
    label: "Vocabulary preview",
    subject: "ela",
    prerequisites: [],
    topicKeywords: ["vocabulary", "word meaning"],
    standards: ["CCSS.ELA.L.4"],
  },
  {
    code: "ELA.WRITE.SCAFFOLD",
    label: "Writing scaffold",
    subject: "ela",
    prerequisites: ["ELA.READ.COMPREHEND"],
    topicKeywords: ["write", "compose"],
    standards: ["CCSS.ELA.W"],
  },

  // World language
  {
    code: "WL.LISTEN.A1",
    label: "Listening A1 comprehension",
    subject: "world_language",
    prerequisites: [],
    topicKeywords: ["listen", "audio", "comprehension"],
    standards: ["CEFR.A1"],
  },
  {
    code: "WL.SPEAK.A1",
    label: "Speaking A1 production",
    subject: "world_language",
    prerequisites: [],
    topicKeywords: ["speak", "produce", "say"],
    standards: ["CEFR.A1"],
  },
];

export function findSkillsByTopic(subject: Subject, topic?: string): SkillNode[] {
  if (!topic) {
    return SKILL_NODES.filter((node) => node.subject === subject);
  }
  const lower = topic.toLowerCase();
  return SKILL_NODES.filter(
    (node) => node.subject === subject && node.topicKeywords.some((kw) => lower.includes(kw)),
  );
}

export function getPrerequisitesFor(skillCodes: string[]): string[] {
  const prereqs = new Set<string>();
  for (const code of skillCodes) {
    const node = SKILL_NODES.find((n) => n.code === code);
    node?.prerequisites.forEach((p) => prereqs.add(p));
  }
  return Array.from(prereqs);
}

export function getStandardsFor(skillCodes: string[]): string[] {
  const set = new Set<string>();
  for (const code of skillCodes) {
    const node = SKILL_NODES.find((n) => n.code === code);
    node?.standards.forEach((s) => set.add(s));
  }
  return Array.from(set);
}
