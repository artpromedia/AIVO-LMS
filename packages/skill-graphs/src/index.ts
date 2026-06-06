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
export { ccssMath1To8 } from "./seeds/ccss-math-1-8.js";
export { ccssMath9To12 } from "./seeds/ccss-math-9-12.js";
export { ngssK2PhysicalScience } from "./seeds/ngss-k2-physical-science.js";
export { ngssScience3To8 } from "./seeds/ngss-science-3-8.js";
export { ngssScience9To12 } from "./seeds/ngss-science-9-12.js";
export { ccssElaKindergarten } from "./seeds/ccss-ela-k.js";
export { ccssEla1To8 } from "./seeds/ccss-ela-1-8.js";
export { ccssEla9To12 } from "./seeds/ccss-ela-9-12.js";
export { ccssWritingK8 } from "./seeds/ccss-writing-k-8.js";
export { c3SocialStudiesK2 } from "./seeds/c3-social-studies-k2.js";
export { c3SocialStudies3To8 } from "./seeds/c3-social-studies-3-8.js";
export { c3SocialStudies9To12 } from "./seeds/c3-social-studies-9-12.js";
export { ngsGeographyK2 } from "./seeds/ncge-geography-k2.js";
export { ncgeGeography3To12 } from "./seeds/ncge-geography-3-12.js";
export { cstaCodingK2 } from "./seeds/csta-coding-k2.js";
export { cstaCoding3To12 } from "./seeds/csta-coding-3-12.js";
export { ashaSpeechEarly } from "./seeds/asha-speech-early.js";
export { ashaSpeechSchoolAge } from "./seeds/asha-speech-school-age.js";
export { caselSelK2 } from "./seeds/casel-sel-k2.js";
export { caselSel3To12 } from "./seeds/casel-sel-3-12.js";
export { ncasMusicK2 } from "./seeds/ncas-music-k2.js";
export { ncasMusic3To8 } from "./seeds/ncas-music-3-8.js";
export { shapePeHealthK2 } from "./seeds/shape-pe-health-k2.js";
export { shapePeHealth3To12 } from "./seeds/shape-pe-health-3-12.js";
export { actflWorldLanguagesNoviceLow } from "./seeds/actfl-world-languages-novice-low.js";
export { actflWorldLanguages7To12 } from "./seeds/actfl-world-languages-7-12.js";
export { ngssEngineeringDesign35 } from "./seeds/ngss-engineering-design-3-5.js";
export { ngssEngineeringDesign6To12 } from "./seeds/ngss-engineering-design-6-12.js";
export { cecLifeSkills6Plus } from "./seeds/cec-life-skills-6-plus.js";
export { cecLifeSkills9To12 } from "./seeds/cec-life-skills-9-12.js";
export { ncasCreativeArtsK2 } from "./seeds/ncas-creative-arts-k2.js";
export { ncasCreativeArts3To12 } from "./seeds/ncas-creative-arts-3-12.js";
export {
  ccssWriting9To12,
  ashaSpeech9To12,
  executiveFunctionK12,
  cecLifeSkillsK5,
  actflWorldLanguagesK5,
  ncasMusic9To12,
  ngssEngineeringK2,
} from "./seeds/catalog-k12-completion.js";
export {
  preKMathFoundations,
  preKElaFoundations,
  preKWritingFoundations,
  preKScienceFoundations,
  preKSelFoundations,
  preKSpeechFoundations,
  preKExecutiveFunctionFoundations,
  preKLifeSkillsFoundations,
  preKCreativeArtsFoundations,
  preKSocialStudiesFoundations,
  preKWorldLanguagesFoundations,
  preKCodingFoundations,
  preKGeographyFoundations,
  preKMusicFoundations,
  preKPeHealthFoundations,
  preKStemEngineeringFoundations,
} from "./seeds/catalog-prek-foundations.js";

import { ccssMathKindergarten } from "./seeds/ccss-math-k.js";
import { ccssMath1To8 } from "./seeds/ccss-math-1-8.js";
import { ccssMath9To12 } from "./seeds/ccss-math-9-12.js";
import { ngssK2PhysicalScience } from "./seeds/ngss-k2-physical-science.js";
import { ngssScience3To8 } from "./seeds/ngss-science-3-8.js";
import { ngssScience9To12 } from "./seeds/ngss-science-9-12.js";
import { ccssElaKindergarten } from "./seeds/ccss-ela-k.js";
import { ccssEla1To8 } from "./seeds/ccss-ela-1-8.js";
import { ccssEla9To12 } from "./seeds/ccss-ela-9-12.js";
import { ccssWritingK8 } from "./seeds/ccss-writing-k-8.js";
import { c3SocialStudiesK2 } from "./seeds/c3-social-studies-k2.js";
import { c3SocialStudies3To8 } from "./seeds/c3-social-studies-3-8.js";
import { c3SocialStudies9To12 } from "./seeds/c3-social-studies-9-12.js";
import { ngsGeographyK2 } from "./seeds/ncge-geography-k2.js";
import { ncgeGeography3To12 } from "./seeds/ncge-geography-3-12.js";
import { cstaCodingK2 } from "./seeds/csta-coding-k2.js";
import { cstaCoding3To12 } from "./seeds/csta-coding-3-12.js";
import { ashaSpeechEarly } from "./seeds/asha-speech-early.js";
import { ashaSpeechSchoolAge } from "./seeds/asha-speech-school-age.js";
import { caselSelK2 } from "./seeds/casel-sel-k2.js";
import { caselSel3To12 } from "./seeds/casel-sel-3-12.js";
import { ncasMusicK2 } from "./seeds/ncas-music-k2.js";
import { ncasMusic3To8 } from "./seeds/ncas-music-3-8.js";
import { shapePeHealthK2 } from "./seeds/shape-pe-health-k2.js";
import { shapePeHealth3To12 } from "./seeds/shape-pe-health-3-12.js";
import { actflWorldLanguagesNoviceLow } from "./seeds/actfl-world-languages-novice-low.js";
import { actflWorldLanguages7To12 } from "./seeds/actfl-world-languages-7-12.js";
import { ngssEngineeringDesign35 } from "./seeds/ngss-engineering-design-3-5.js";
import { ngssEngineeringDesign6To12 } from "./seeds/ngss-engineering-design-6-12.js";
import { cecLifeSkills6Plus } from "./seeds/cec-life-skills-6-plus.js";
import { cecLifeSkills9To12 } from "./seeds/cec-life-skills-9-12.js";
import { ncasCreativeArtsK2 } from "./seeds/ncas-creative-arts-k2.js";
import { ncasCreativeArts3To12 } from "./seeds/ncas-creative-arts-3-12.js";
import {
  ccssWriting9To12,
  ashaSpeech9To12,
  executiveFunctionK12,
  cecLifeSkillsK5,
  actflWorldLanguagesK5,
  ncasMusic9To12,
  ngssEngineeringK2,
} from "./seeds/catalog-k12-completion.js";
import {
  preKMathFoundations,
  preKElaFoundations,
  preKWritingFoundations,
  preKScienceFoundations,
  preKSelFoundations,
  preKSpeechFoundations,
  preKExecutiveFunctionFoundations,
  preKLifeSkillsFoundations,
  preKCreativeArtsFoundations,
  preKSocialStudiesFoundations,
  preKWorldLanguagesFoundations,
  preKCodingFoundations,
  preKGeographyFoundations,
  preKMusicFoundations,
  preKPeHealthFoundations,
  preKStemEngineeringFoundations,
} from "./seeds/catalog-prek-foundations.js";
import type { SkillGraph } from "./types.js";

/** All seed graphs that ship with this package, in registration order. */
export const SEED_GRAPHS: readonly SkillGraph[] = [
  preKMathFoundations,
  preKElaFoundations,
  preKWritingFoundations,
  preKScienceFoundations,
  preKSelFoundations,
  preKSpeechFoundations,
  preKExecutiveFunctionFoundations,
  preKLifeSkillsFoundations,
  preKCreativeArtsFoundations,
  preKSocialStudiesFoundations,
  preKWorldLanguagesFoundations,
  preKCodingFoundations,
  preKGeographyFoundations,
  preKMusicFoundations,
  preKPeHealthFoundations,
  preKStemEngineeringFoundations,
  ccssMathKindergarten,
  ccssMath1To8,
  ccssMath9To12,
  ngssK2PhysicalScience,
  ngssScience3To8,
  ngssScience9To12,
  ccssElaKindergarten,
  ccssEla1To8,
  ccssEla9To12,
  ccssWritingK8,
  c3SocialStudiesK2,
  c3SocialStudies3To8,
  c3SocialStudies9To12,
  ngsGeographyK2,
  ncgeGeography3To12,
  cstaCodingK2,
  cstaCoding3To12,
  ashaSpeechEarly,
  ashaSpeechSchoolAge,
  caselSelK2,
  caselSel3To12,
  ncasMusicK2,
  ncasMusic3To8,
  shapePeHealthK2,
  shapePeHealth3To12,
  actflWorldLanguagesNoviceLow,
  actflWorldLanguages7To12,
  ngssEngineeringDesign35,
  ngssEngineeringDesign6To12,
  cecLifeSkills6Plus,
  cecLifeSkills9To12,
  ncasCreativeArtsK2,
  ncasCreativeArts3To12,
  ccssWriting9To12,
  ashaSpeech9To12,
  executiveFunctionK12,
  cecLifeSkillsK5,
  actflWorldLanguagesK5,
  ncasMusic9To12,
  ngssEngineeringK2,
];

/** Look up a seed graph by id. Returns `undefined` if not found. */
export function getSeedGraph(id: string): SkillGraph | undefined {
  return SEED_GRAPHS.find((g) => g.id === id);
}
