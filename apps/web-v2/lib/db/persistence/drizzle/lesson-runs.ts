/**
 * Drizzle-backed LessonRunStore — stub.
 *
 * `packages/db/src/schema/learning.ts` already ships the row schema
 * for lesson runs + generated plans. The Drizzle implementation is a
 * follow-up that:
 *
 *   1. Maps row shapes via `mapRowToRun`, `mapRowToPlan`,
 *      `mapRowToInteraction`, `mapRowToParentSummary`.
 *   2. Uses `LIMIT` + `ORDER BY created_at DESC` for `listForLearner`.
 *   3. Wraps interaction appends in a single transaction with the
 *      lessonRuns.updatedAt bump (mirrors completeLessonRun's
 *      multi-row write).
 */
import type { LessonRunStore } from "../types";

function notImplemented(method: string): never {
  throw new Error(
    `[persistence.drizzle.lessonRuns.${method}] not implemented. ` +
      `Wire packages/db/src/schema/learning.ts into the adapter ` +
      `before flipping AIVO_PERSISTENCE_LESSON_RUNS=postgres.`,
  );
}

export const drizzleLessonRuns: LessonRunStore = {
  async getRunById() {
    return notImplemented("getRunById");
  },
  async upsertRun() {
    return notImplemented("upsertRun");
  },
  async listForLearner() {
    return notImplemented("listForLearner");
  },
  async countForLearner() {
    return notImplemented("countForLearner");
  },
  async getPlanById() {
    return notImplemented("getPlanById");
  },
  async upsertPlan() {
    return notImplemented("upsertPlan");
  },
  async appendInteraction() {
    return notImplemented("appendInteraction");
  },
  async listInteractions() {
    return notImplemented("listInteractions");
  },
  async upsertParentSummary() {
    return notImplemented("upsertParentSummary");
  },
  async getParentSummaryForRun() {
    return notImplemented("getParentSummaryForRun");
  },
};
