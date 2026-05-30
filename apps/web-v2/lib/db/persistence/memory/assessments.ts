/**
 * In-memory AssessmentStore — wraps the existing
 * parentAssessments / baselineAssessments / baselineQuestions Maps
 * and the baselineAttempts array. Selected when
 * AIVO_PERSISTENCE_ASSESSMENTS=memory (the default).
 *
 * Preserves legacy semantics:
 *   - replaceAttemptsForQuestion drops any prior attempt for the same
 *     (questionId, learnerId) pair before inserting the new one, so
 *     "latest answer wins" stays true across replays.
 *   - listBaselineQuestions returns questions sorted by `order`.
 *   - upsertBaseline is set-not-merge: the caller hands in the full
 *     row, including generationMetadata + summary updates.
 */
import { getStore } from "@/lib/db/store";
import type {
  BaselineAssessment,
  BaselineAttempt,
  BaselineItemResponseLog,
  BaselineQuestion,
} from "@/lib/db/types";
import type { AssessmentStore } from "../types";

export const memoryAssessments: AssessmentStore = {
  async findParentAssessment(learnerId, tenantId) {
    for (const a of getStore().parentAssessments.values()) {
      if (a.learnerId === learnerId && a.tenantId === tenantId) return a;
    }
    return null;
  },

  async upsertParentAssessment(assessment) {
    getStore().parentAssessments.set(assessment.id, assessment);
    return assessment;
  },

  async getBaselineById(baselineId, tenantId) {
    const b = getStore().baselineAssessments.get(baselineId);
    if (!b || b.tenantId !== tenantId) return null;
    return b;
  },

  async getActiveBaselineForLearner(learnerId, tenantId) {
    let latest: BaselineAssessment | null = null;
    for (const b of getStore().baselineAssessments.values()) {
      if (b.learnerId !== learnerId || b.tenantId !== tenantId) continue;
      if (!latest || b.createdAt > latest.createdAt) latest = b;
    }
    return latest;
  },

  async upsertBaseline(baseline) {
    getStore().baselineAssessments.set(baseline.id, baseline);
    return baseline;
  },

  async listBaselineQuestions(baselineId) {
    return Array.from(getStore().baselineQuestions.values())
      .filter((q) => q.baselineId === baselineId)
      .sort((a, b) => a.order - b.order);
  },

  async appendBaselineQuestions(questions: BaselineQuestion[]) {
    const store = getStore();
    for (const q of questions) store.baselineQuestions.set(q.id, q);
  },

  async listBaselineAttempts(baselineId, tenantId) {
    return getStore().baselineAttempts.filter(
      (a) => a.baselineId === baselineId && a.tenantId === tenantId,
    );
  },

  async recordBaselineAttempt(attempt: BaselineAttempt, replaceWhere) {
    const store = getStore();
    store.baselineAttempts = store.baselineAttempts.filter(
      (a) => !(a.questionId === replaceWhere.questionId && a.learnerId === replaceWhere.learnerId),
    );
    store.baselineAttempts.push(attempt);
    return attempt;
  },

  async appendBaselineTelemetry(logs: BaselineItemResponseLog[]) {
    if (logs.length > 0) getStore().baselineItemResponseLogs.push(...logs);
  },

  async listBaselineTelemetry({ tenantId, learnerId }) {
    return getStore().baselineItemResponseLogs.filter(
      (l) => l.tenantId === tenantId && (learnerId === undefined || l.learnerId === learnerId),
    );
  },
};
