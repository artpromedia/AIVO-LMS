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

  // Social-Emotional (CASEL competencies)
  {
    code: "SEL.SELF_AWARE",
    label: "Self-awareness",
    subject: "social_emotional",
    prerequisites: [],
    topicKeywords: ["feeling", "emotion", "self", "aware", "identify"],
    standards: ["CASEL.SELF_AWARE"],
  },
  {
    code: "SEL.SELF_MANAGE",
    label: "Self-management",
    subject: "social_emotional",
    prerequisites: ["SEL.SELF_AWARE"],
    topicKeywords: ["calm", "regulate", "manage", "cope", "control"],
    standards: ["CASEL.SELF_MANAGE"],
  },
  {
    code: "SEL.SOCIAL_AWARE",
    label: "Social-awareness",
    subject: "social_emotional",
    prerequisites: ["SEL.SELF_AWARE"],
    topicKeywords: ["empathy", "perspective", "others", "diverse"],
    standards: ["CASEL.SOCIAL_AWARE"],
  },
  {
    code: "SEL.RELATIONSHIP",
    label: "Relationship skills",
    subject: "social_emotional",
    prerequisites: ["SEL.SOCIAL_AWARE"],
    topicKeywords: ["friend", "communicate", "cooperate", "conflict"],
    standards: ["CASEL.RELATIONSHIP"],
  },
  {
    code: "SEL.DECISION",
    label: "Responsible decision-making",
    subject: "social_emotional",
    prerequisites: ["SEL.SELF_MANAGE", "SEL.SOCIAL_AWARE"],
    topicKeywords: ["decision", "choice", "responsible", "consequence"],
    standards: ["CASEL.DECISION"],
  },

  // Executive Function
  {
    code: "EF.WORKING_MEMORY",
    label: "Working memory",
    subject: "executive_function",
    prerequisites: [],
    topicKeywords: ["remember", "memory", "recall", "sequence"],
    standards: ["EF.WM"],
  },
  {
    code: "EF.INHIBITION",
    label: "Inhibitory control",
    subject: "executive_function",
    prerequisites: [],
    topicKeywords: ["wait", "stop", "impulse", "inhibit"],
    standards: ["EF.IC"],
  },
  {
    code: "EF.FLEX",
    label: "Cognitive flexibility",
    subject: "executive_function",
    prerequisites: ["EF.WORKING_MEMORY"],
    topicKeywords: ["switch", "flexible", "rule change", "sort"],
    standards: ["EF.CF"],
  },
  {
    code: "EF.PLAN",
    label: "Planning and organization",
    subject: "executive_function",
    prerequisites: ["EF.WORKING_MEMORY", "EF.FLEX"],
    topicKeywords: ["plan", "organize", "steps", "order"],
    standards: ["EF.PLAN"],
  },
  {
    code: "EF.TASK_INITIATION",
    label: "Task initiation",
    subject: "executive_function",
    prerequisites: ["EF.INHIBITION"],
    topicKeywords: ["start", "begin", "initiate"],
    standards: ["EF.TI"],
  },

  // Life Skills
  {
    code: "LIFE.SELF_CARE",
    label: "Self-care routines",
    subject: "life_skills",
    prerequisites: [],
    topicKeywords: ["hygiene", "brush", "wash", "self-care", "routine"],
    standards: ["LIFE.SC"],
  },
  {
    code: "LIFE.SAFETY",
    label: "Personal safety",
    subject: "life_skills",
    prerequisites: [],
    topicKeywords: ["safety", "danger", "stranger", "emergency"],
    standards: ["LIFE.SAFE"],
  },
  {
    code: "LIFE.MONEY",
    label: "Money basics",
    subject: "life_skills",
    prerequisites: [],
    topicKeywords: ["money", "coin", "dollar", "spend", "save"],
    standards: ["LIFE.MONEY"],
  },
  {
    code: "LIFE.HOUSEHOLD",
    label: "Household tasks",
    subject: "life_skills",
    prerequisites: [],
    topicKeywords: ["clean", "cook", "laundry", "chore"],
    standards: ["LIFE.HH"],
  },
  {
    code: "LIFE.COMMUNITY",
    label: "Community navigation",
    subject: "life_skills",
    prerequisites: [],
    topicKeywords: ["community", "transit", "store", "neighborhood"],
    standards: ["LIFE.COMM"],
  },

  // Social Studies — Civics, Geography, History, Economics (K-8 seed)
  {
    code: "SS.CIV.RULES_K2",
    label: "Rules and fairness (K-2)",
    subject: "social_studies",
    prerequisites: [],
    topicKeywords: ["rules", "fairness", "classroom", "community"],
    standards: ["NCSS.K-2.CIV"],
  },
  {
    code: "SS.CIV.GOV_3_5",
    label: "Three branches of government (3-5)",
    subject: "social_studies",
    prerequisites: ["SS.CIV.RULES_K2"],
    topicKeywords: ["government", "branches", "congress", "president", "court"],
    standards: ["NCSS.3-5.CIV"],
  },
  {
    code: "SS.CIV.CONST_6_8",
    label: "Constitutional principles (6-8)",
    subject: "social_studies",
    prerequisites: ["SS.CIV.GOV_3_5"],
    topicKeywords: ["constitution", "amendment", "rights", "bill of rights"],
    standards: ["NCSS.6-8.CIV"],
  },
  {
    code: "SS.CIV.CITIZEN",
    label: "Citizenship and participation",
    subject: "social_studies",
    prerequisites: ["SS.CIV.RULES_K2"],
    topicKeywords: ["citizen", "vote", "participate", "civic"],
    standards: ["NCSS.CITIZEN"],
  },
  {
    code: "SS.GEO.MAPS_K2",
    label: "Maps and globes (K-2)",
    subject: "social_studies",
    prerequisites: [],
    topicKeywords: ["map", "globe", "north", "south", "compass"],
    standards: ["NCSS.K-2.GEO"],
  },
  {
    code: "SS.GEO.REGIONS_3_5",
    label: "U.S. and world regions (3-5)",
    subject: "social_studies",
    prerequisites: ["SS.GEO.MAPS_K2"],
    topicKeywords: ["region", "continent", "country", "state"],
    standards: ["NCSS.3-5.GEO"],
  },
  {
    code: "SS.GEO.PHYSICAL_6_8",
    label: "Physical geography (6-8)",
    subject: "social_studies",
    prerequisites: ["SS.GEO.REGIONS_3_5"],
    topicKeywords: ["climate", "landform", "biome", "geography"],
    standards: ["NCSS.6-8.GEO"],
  },
  {
    code: "SS.GEO.HUMAN",
    label: "Human geography and culture",
    subject: "social_studies",
    prerequisites: ["SS.GEO.REGIONS_3_5"],
    topicKeywords: ["culture", "population", "migration", "language"],
    standards: ["NCSS.HUMAN_GEO"],
  },
  {
    code: "SS.HIST.TIME_K2",
    label: "Time and chronology (K-2)",
    subject: "social_studies",
    prerequisites: [],
    topicKeywords: ["timeline", "long ago", "today", "yesterday", "history"],
    standards: ["NCSS.K-2.HIST"],
  },
  {
    code: "SS.HIST.NATIVE",
    label: "Native peoples of the Americas",
    subject: "social_studies",
    prerequisites: ["SS.HIST.TIME_K2"],
    topicKeywords: ["native", "indigenous", "tribe", "first peoples"],
    standards: ["NCSS.HIST.NATIVE"],
  },
  {
    code: "SS.HIST.COLONIAL",
    label: "Colonial America (3-5)",
    subject: "social_studies",
    prerequisites: ["SS.HIST.TIME_K2"],
    topicKeywords: ["colonial", "colony", "pilgrim", "settlement"],
    standards: ["NCSS.3-5.HIST"],
  },
  {
    code: "SS.HIST.REVOLUTION",
    label: "American Revolution",
    subject: "social_studies",
    prerequisites: ["SS.HIST.COLONIAL"],
    topicKeywords: ["revolution", "independence", "declaration"],
    standards: ["NCSS.HIST.REV"],
  },
  {
    code: "SS.HIST.CIVIL_WAR",
    label: "Civil War and Reconstruction",
    subject: "social_studies",
    prerequisites: ["SS.HIST.REVOLUTION"],
    topicKeywords: ["civil war", "abolition", "reconstruction", "slavery"],
    standards: ["NCSS.HIST.CW"],
  },
  {
    code: "SS.HIST.IMMIGRATION",
    label: "Industrialization and immigration",
    subject: "social_studies",
    prerequisites: ["SS.HIST.CIVIL_WAR"],
    topicKeywords: ["industrial", "immigration", "factory", "urban"],
    standards: ["NCSS.HIST.IMM"],
  },
  {
    code: "SS.HIST.WORLD_WARS",
    label: "20th century world conflicts (6-8)",
    subject: "social_studies",
    prerequisites: ["SS.HIST.IMMIGRATION"],
    topicKeywords: ["world war", "wwi", "wwii", "20th century"],
    standards: ["NCSS.6-8.HIST"],
  },
  {
    code: "SS.HIST.CIVIL_RIGHTS",
    label: "Civil Rights movement",
    subject: "social_studies",
    prerequisites: ["SS.HIST.CIVIL_WAR"],
    topicKeywords: ["civil rights", "king", "march", "equality"],
    standards: ["NCSS.HIST.CR"],
  },
  {
    code: "SS.HIST.WORLD_ANCIENT",
    label: "Ancient civilizations",
    subject: "social_studies",
    prerequisites: ["SS.HIST.TIME_K2"],
    topicKeywords: ["ancient", "egypt", "greece", "rome", "mesopotamia"],
    standards: ["NCSS.HIST.ANCIENT"],
  },
  {
    code: "SS.HIST.WORLD_MEDIEVAL",
    label: "Medieval world",
    subject: "social_studies",
    prerequisites: ["SS.HIST.WORLD_ANCIENT"],
    topicKeywords: ["medieval", "middle ages", "feudal", "knight"],
    standards: ["NCSS.HIST.MED"],
  },
  {
    code: "SS.ECON.NEEDS_K2",
    label: "Needs vs. wants (K-2)",
    subject: "social_studies",
    prerequisites: [],
    topicKeywords: ["needs", "wants", "economic", "choose"],
    standards: ["NCSS.K-2.ECON"],
  },
  {
    code: "SS.ECON.GOODS",
    label: "Goods, services, and producers (3-5)",
    subject: "social_studies",
    prerequisites: ["SS.ECON.NEEDS_K2"],
    topicKeywords: ["goods", "services", "producer", "consumer"],
    standards: ["NCSS.3-5.ECON"],
  },
  {
    code: "SS.ECON.MARKET",
    label: "Markets and supply/demand (6-8)",
    subject: "social_studies",
    prerequisites: ["SS.ECON.GOODS"],
    topicKeywords: ["market", "supply", "demand", "price"],
    standards: ["NCSS.6-8.ECON"],
  },
  {
    code: "SS.ECON.TRADE",
    label: "Trade and global economy",
    subject: "social_studies",
    prerequisites: ["SS.ECON.MARKET"],
    topicKeywords: ["trade", "export", "import", "global"],
    standards: ["NCSS.ECON.TRADE"],
  },
  {
    code: "SS.ECON.MONEY",
    label: "Money and personal finance",
    subject: "social_studies",
    prerequisites: ["SS.ECON.NEEDS_K2"],
    topicKeywords: ["money", "currency", "save", "budget"],
    standards: ["NCSS.ECON.MONEY"],
  },
  {
    code: "SS.CIV.LOCAL_GOV",
    label: "Local government",
    subject: "social_studies",
    prerequisites: ["SS.CIV.RULES_K2"],
    topicKeywords: ["mayor", "city", "council", "local"],
    standards: ["NCSS.CIV.LOCAL"],
  },
  {
    code: "SS.CIV.STATE_GOV",
    label: "State government",
    subject: "social_studies",
    prerequisites: ["SS.CIV.LOCAL_GOV"],
    topicKeywords: ["governor", "state legislature", "state law"],
    standards: ["NCSS.CIV.STATE"],
  },
  {
    code: "SS.CIV.FED_GOV",
    label: "Federal government structure",
    subject: "social_studies",
    prerequisites: ["SS.CIV.STATE_GOV"],
    topicKeywords: ["federal", "congress", "supreme court", "executive"],
    standards: ["NCSS.CIV.FED"],
  },
  {
    code: "SS.GEO.US_STATES",
    label: "U.S. states and capitals",
    subject: "social_studies",
    prerequisites: ["SS.GEO.REGIONS_3_5"],
    topicKeywords: ["state", "capital", "united states"],
    standards: ["NCSS.GEO.US"],
  },
  {
    code: "SS.GEO.WORLD_COUNTRIES",
    label: "Countries of the world",
    subject: "social_studies",
    prerequisites: ["SS.GEO.REGIONS_3_5"],
    topicKeywords: ["country", "capital", "world"],
    standards: ["NCSS.GEO.WORLD"],
  },
  {
    code: "SS.HIST.EXPLORATION",
    label: "Age of Exploration",
    subject: "social_studies",
    prerequisites: ["SS.HIST.WORLD_MEDIEVAL"],
    topicKeywords: ["explorer", "voyage", "columbus", "new world"],
    standards: ["NCSS.HIST.EXP"],
  },
  {
    code: "SS.HIST.AMERICAN_WEST",
    label: "Westward expansion",
    subject: "social_studies",
    prerequisites: ["SS.HIST.REVOLUTION"],
    topicKeywords: ["west", "expansion", "frontier", "manifest destiny"],
    standards: ["NCSS.HIST.WEST"],
  },
  {
    code: "SS.CUL.HOLIDAYS",
    label: "Cultural holidays and traditions",
    subject: "social_studies",
    prerequisites: ["SS.GEO.HUMAN"],
    topicKeywords: ["holiday", "tradition", "culture", "celebration"],
    standards: ["NCSS.CUL.HOL"],
  },
  {
    code: "SS.CUL.RELIGION",
    label: "World religions",
    subject: "social_studies",
    prerequisites: ["SS.GEO.HUMAN"],
    topicKeywords: ["religion", "belief", "worship"],
    standards: ["NCSS.CUL.REL"],
  },
  {
    code: "SS.GEO.ENVIRONMENT",
    label: "Environment and resources",
    subject: "social_studies",
    prerequisites: ["SS.GEO.PHYSICAL_6_8"],
    topicKeywords: ["environment", "resource", "conservation", "natural"],
    standards: ["NCSS.GEO.ENV"],
  },
  {
    code: "SS.ECON.SCARCITY",
    label: "Scarcity and choice",
    subject: "social_studies",
    prerequisites: ["SS.ECON.NEEDS_K2"],
    topicKeywords: ["scarcity", "limited", "choice", "tradeoff"],
    standards: ["NCSS.ECON.SCAR"],
  },
  {
    code: "SS.CIV.LAW",
    label: "Laws and the legal system",
    subject: "social_studies",
    prerequisites: ["SS.CIV.RULES_K2"],
    topicKeywords: ["law", "court", "justice", "judge"],
    standards: ["NCSS.CIV.LAW"],
  },
  {
    code: "SS.HIST.RECENT",
    label: "Recent U.S. history (1980-present)",
    subject: "social_studies",
    prerequisites: ["SS.HIST.CIVIL_RIGHTS"],
    topicKeywords: ["recent", "modern", "21st century"],
    standards: ["NCSS.HIST.RECENT"],
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
