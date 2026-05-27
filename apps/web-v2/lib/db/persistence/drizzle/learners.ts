/**
 * Drizzle-backed LearnerStore — stub.
 *
 * `packages/db/src/schema/learners.ts` already ships canonical learner
 * + parent_learner_relationships schemas. The Drizzle implementation
 * is a follow-up that:
 *
 *   1. Maps row shapes via `mapRowToLearner` / `mapRowToRelationship`.
 *   2. Implements teacherCanAccess + listForTeacher by joining
 *      classrooms + enrollments (also in packages/db).
 *   3. Wraps `create` and `delete` in transactions (multi-row writes).
 *
 * Until then, flipping AIVO_PERSISTENCE_LEARNERS=postgres hits the
 * explicit error below.
 */
import type { LearnerStore } from "../types";

function notImplemented(method: string): never {
  throw new Error(
    `[persistence.drizzle.learners.${method}] not implemented. ` +
      `Wire packages/db/src/schema/learners.ts into the adapter ` +
      `before flipping AIVO_PERSISTENCE_LEARNERS=postgres.`,
  );
}

export const drizzleLearners: LearnerStore = {
  async getById() {
    return notImplemented("getById");
  },
  async listForParent() {
    return notImplemented("listForParent");
  },
  async listForTeacher() {
    return notImplemented("listForTeacher");
  },
  async listForTenants() {
    return notImplemented("listForTenants");
  },
  async parentCanAccess() {
    return notImplemented("parentCanAccess");
  },
  async teacherCanAccess() {
    return notImplemented("teacherCanAccess");
  },
  async findPrimaryParent() {
    return notImplemented("findPrimaryParent");
  },
  async create() {
    return notImplemented("create");
  },
  async update() {
    return notImplemented("update");
  },
  async delete() {
    return notImplemented("delete");
  },
  async setReadinessState() {
    return notImplemented("setReadinessState");
  },
};
