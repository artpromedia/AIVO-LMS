import { MathSubjectBrain } from "./math-subject-brain.js";
import { ScienceSubjectBrain } from "./science-subject-brain.js";
import { ElaSubjectBrain } from "./ela-subject-brain.js";
import { WorldLanguageSubjectBrain } from "./world-language-subject-brain.js";
import { SocialEmotionalBrain } from "../brains/social-emotional/index.js";
import { ExecutiveFunctionBrain } from "../brains/executive-function/index.js";
import { LifeSkillsBrain } from "../brains/life-skills/index.js";
import { SocialStudiesBrain } from "../brains/social-studies/index.js";
import { CodingBrain } from "../brains/coding/index.js";
import { SpeechBrain } from "../brains/speech/index.js";
import { CreativeArtsBrain } from "../brains/creative-arts/index.js";
import { StemEngineeringBrain } from "../brains/stem-engineering/index.js";
import { MusicBrain } from "../brains/music/index.js";
import { PeHealthBrain } from "../brains/pe-health/index.js";
import type {
  Subject,
  SubjectBrain,
  SubjectContextRequest,
  SubjectContextResponse,
} from "./types.js";

const BRAINS: Record<string, SubjectBrain> = {
  math: new MathSubjectBrain(),
  science: new ScienceSubjectBrain(),
  ela: new ElaSubjectBrain(),
  world_language: new WorldLanguageSubjectBrain(),
  social_emotional: new SocialEmotionalBrain(),
  executive_function: new ExecutiveFunctionBrain(),
  life_skills: new LifeSkillsBrain(),
  social_studies: new SocialStudiesBrain(),
  // Sprint D — completion plan additions.
  coding: new CodingBrain(),
  speech: new SpeechBrain(),
  creative_arts: new CreativeArtsBrain(),
  stem_engineering: new StemEngineeringBrain(),
  // Sprint C.2 — final two brains; catalog of 14 tutors now fully covered.
  music: new MusicBrain(),
  pe_health: new PeHealthBrain(),
};

export function getSubjectBrain(subject: Subject): SubjectBrain | undefined {
  return BRAINS[subject];
}

export function buildSubjectContext(
  request: SubjectContextRequest,
): SubjectContextResponse | undefined {
  const brain = getSubjectBrain(request.subject);
  return brain?.context(request);
}

export { MathSubjectBrain } from "./math-subject-brain.js";
export { ScienceSubjectBrain } from "./science-subject-brain.js";
export { ElaSubjectBrain } from "./ela-subject-brain.js";
export { WorldLanguageSubjectBrain } from "./world-language-subject-brain.js";
export { SocialEmotionalBrain } from "../brains/social-emotional/index.js";
export { ExecutiveFunctionBrain } from "../brains/executive-function/index.js";
export { LifeSkillsBrain } from "../brains/life-skills/index.js";
export { SocialStudiesBrain } from "../brains/social-studies/index.js";
export { CodingBrain } from "../brains/coding/index.js";
export { SpeechBrain } from "../brains/speech/index.js";
export { CreativeArtsBrain } from "../brains/creative-arts/index.js";
export { StemEngineeringBrain } from "../brains/stem-engineering/index.js";
export { MusicBrain } from "../brains/music/index.js";
export { PeHealthBrain } from "../brains/pe-health/index.js";
export * from "./types.js";
