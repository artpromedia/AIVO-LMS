/**
 * Drizzle-backed AssessmentStore — stub.
 *
 * `packages/db/src/schema/assessments.ts` already ships a real
 * schema. The Drizzle implementation is a follow-up that:
 *
 *   1. Maps row shapes via `mapRowToParentAssessment`,
 *      `mapRowToBaseline`, `mapRowToQuestion`, `mapRowToAttempt`.
 *   2. Implements `recordBaselineAttempt` in a single transaction so
 *      the replace-then-append is atomic under concurrent writes.
 *   3. Reads `appendBaselineQuestions` writes in batched INSERT to
 *      avoid N+1 round-trips for the ~14-question payload.
 *
 * Until then, flipping AIVO_PERSISTENCE_ASSESSMENTS=postgres hits the
 * explicit error below.
 */
import type { AssessmentStore } from "../types";

function notImplemented(method: string): never {
  throw new Error(
    `[persistence.drizzle.assessments.${method}] not implemented. ` +
      `Wire packages/db/src/schema/assessments.ts into the adapter ` +
      `before flipping AIVO_PERSISTENCE_ASSESSMENTS=postgres.`,
  );
}

export const drizzleAssessments: AssessmentStore = {
  async findParentAssessment() {
    return notImplemented("findParentAssessment");
  },
  async upsertParentAssessment() {
    return notImplemented("upsertParentAssessment");
  },
  async getBaselineById() {
    return notImplemented("getBaselineById");
  },
  async getActiveBaselineForLearner() {
    return notImplemented("getActiveBaselineForLearner");
  },
  async upsertBaseline() {
    return notImplemented("upsertBaseline");
  },
  async listBaselineQuestions() {
    return notImplemented("listBaselineQuestions");
  },
  async appendBaselineQuestions() {
    return notImplemented("appendBaselineQuestions");
  },
  async listBaselineAttempts() {
    return notImplemented("listBaselineAttempts");
  },
  async recordBaselineAttempt() {
    return notImplemented("recordBaselineAttempt");
  },
  async appendBaselineTelemetry() {
    return notImplemented("appendBaselineTelemetry");
  },
  async listBaselineTelemetry() {
    return notImplemented("listBaselineTelemetry");
  },
};
