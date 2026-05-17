/**
 * `@aivo/skill-graphs` — static, standards-anchored curriculum graphs.
 *
 * v0.2 ships starter seed graphs for every tutor in the catalog: math
 * (CCSS-K), science (NGSS K–2 Physical Science), ELA (CCSS-K),
 * social studies (C3 K–2), geography (NCGE K–2), coding (CSTA 1A),
 * speech (ASHA early childhood), SEL (CASEL 5 K–2), music (NCAS K–2),
 * PE & health (SHAPE K–2), world languages (ACTFL Novice Low),
 * STEM/engineering (NGSS 3-5-ETS1), life skills (CEC 6+), and creative
 * arts (NCAS K–2). Future versions deepen each graph and add higher
 * grade bands.
 */
export type {
  FrameworkId,
  FrameworkRef,
  Subject,
  GradeBand,
  Skill,
  SkillGraph,
  GraphIssue,
} from "./types.js";

export {
  validateGraph,
  indexGraph,
  getSkill,
  topologicalSort,
  findByFrameworkCode,
  prerequisiteClosure,
} from "./graph.js";

export { ccssMathKindergarten } from "./seeds/ccss-math-k.js";
export { ngssK2PhysicalScience } from "./seeds/ngss-k2-physical-science.js";
export { ccssElaKindergarten } from "./seeds/ccss-ela-k.js";
export { c3SocialStudiesK2 } from "./seeds/c3-social-studies-k2.js";
export { ngsGeographyK2 } from "./seeds/ncge-geography-k2.js";
export { cstaCodingK2 } from "./seeds/csta-coding-k2.js";
export { ashaSpeechEarly } from "./seeds/asha-speech-early.js";
export { caselSelK2 } from "./seeds/casel-sel-k2.js";
export { ncasMusicK2 } from "./seeds/ncas-music-k2.js";
export { shapePeHealthK2 } from "./seeds/shape-pe-health-k2.js";
export { actflWorldLanguagesNoviceLow } from "./seeds/actfl-world-languages-novice-low.js";
export { ngssEngineeringDesign35 } from "./seeds/ngss-engineering-design-3-5.js";
export { cecLifeSkills6Plus } from "./seeds/cec-life-skills-6-plus.js";
export { ncasCreativeArtsK2 } from "./seeds/ncas-creative-arts-k2.js";

import { ccssMathKindergarten } from "./seeds/ccss-math-k.js";
import { ngssK2PhysicalScience } from "./seeds/ngss-k2-physical-science.js";
import { ccssElaKindergarten } from "./seeds/ccss-ela-k.js";
import { c3SocialStudiesK2 } from "./seeds/c3-social-studies-k2.js";
import { ngsGeographyK2 } from "./seeds/ncge-geography-k2.js";
import { cstaCodingK2 } from "./seeds/csta-coding-k2.js";
import { ashaSpeechEarly } from "./seeds/asha-speech-early.js";
import { caselSelK2 } from "./seeds/casel-sel-k2.js";
import { ncasMusicK2 } from "./seeds/ncas-music-k2.js";
import { shapePeHealthK2 } from "./seeds/shape-pe-health-k2.js";
import { actflWorldLanguagesNoviceLow } from "./seeds/actfl-world-languages-novice-low.js";
import { ngssEngineeringDesign35 } from "./seeds/ngss-engineering-design-3-5.js";
import { cecLifeSkills6Plus } from "./seeds/cec-life-skills-6-plus.js";
import { ncasCreativeArtsK2 } from "./seeds/ncas-creative-arts-k2.js";
import type { SkillGraph } from "./types.js";

/** All seed graphs that ship with this package, in registration order. */
export const SEED_GRAPHS: readonly SkillGraph[] = [
  ccssMathKindergarten,
  ngssK2PhysicalScience,
  ccssElaKindergarten,
  c3SocialStudiesK2,
  ngsGeographyK2,
  cstaCodingK2,
  ashaSpeechEarly,
  caselSelK2,
  ncasMusicK2,
  shapePeHealthK2,
  actflWorldLanguagesNoviceLow,
  ngssEngineeringDesign35,
  cecLifeSkills6Plus,
  ncasCreativeArtsK2,
];

/** Look up a seed graph by id. Returns `undefined` if not found. */
export function getSeedGraph(id: string): SkillGraph | undefined {
  return SEED_GRAPHS.find((g) => g.id === id);
}
