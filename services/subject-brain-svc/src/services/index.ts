import { MathSubjectBrain } from "./math-subject-brain.js";
import { ScienceSubjectBrain } from "./science-subject-brain.js";
import { ElaSubjectBrain } from "./ela-subject-brain.js";
import { WorldLanguageSubjectBrain } from "./world-language-subject-brain.js";
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
export * from "./types.js";
