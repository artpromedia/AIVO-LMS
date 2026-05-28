/**
 * Drizzle-backed CurriculumStore — stub.
 *
 * `packages/db/src/schema/curriculum.ts` already ships subjects +
 * skills tables. The Drizzle implementation is a follow-up:
 *
 *   1. listSubjects / listSkills — straightforward SELECTs.
 *   2. getMasteryMapForLearner — a single round-trip joining
 *      mastery_maps and skill_masteries.
 *   3. replaceLearningPath — DELETE WHERE learner_id = ? + INSERT,
 *      both inside a single transaction so retries don't lose the
 *      old path.
 */
import type { CurriculumStore } from "../types";

function notImplemented(method: string): never {
  throw new Error(
    `[persistence.drizzle.curriculum.${method}] not implemented. ` +
      `Wire packages/db/src/schema/curriculum.ts into the adapter ` +
      `before flipping AIVO_PERSISTENCE_CURRICULUM=postgres.`,
  );
}

export const drizzleCurriculum: CurriculumStore = {
  async listSubjects() {
    return notImplemented("listSubjects");
  },
  async getSubjectById() {
    return notImplemented("getSubjectById");
  },
  async listSkills() {
    return notImplemented("listSkills");
  },
  async getSkillById() {
    return notImplemented("getSkillById");
  },
  async getMasteryMapForLearner() {
    return notImplemented("getMasteryMapForLearner");
  },
  async getLearningPath() {
    return notImplemented("getLearningPath");
  },
  async replaceLearningPath() {
    return notImplemented("replaceLearningPath");
  },
};
