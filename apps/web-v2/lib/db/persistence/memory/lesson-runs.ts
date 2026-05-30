/**
 * In-memory LessonRunStore — wraps the lessonRuns / generatedLessonPlans /
 * parentLessonSummaries Maps + the lessonInteractions array. Selected
 * when AIVO_PERSISTENCE_LESSON_RUNS=memory (the default).
 *
 * Order semantics for listForLearner:
 *   - Newest first by createdAt (string ISO compare).
 *   - Optional status filter is applied before the limit.
 */
import { getStore } from "@/lib/db/store";
import type {
  GeneratedLessonPlan,
  LessonInteraction,
  ParentLessonSummary,
} from "@/lib/db/types";
import type { LessonRunStore } from "../types";

export const memoryLessonRuns: LessonRunStore = {
  async getRunById(lessonRunId, tenantId) {
    const r = getStore().lessonRuns.get(lessonRunId);
    if (!r || r.tenantId !== tenantId) return null;
    return r;
  },

  async upsertRun(run) {
    getStore().lessonRuns.set(run.id, run);
    return run;
  },

  async listForLearner(learnerId, tenantId, opts) {
    const limit = opts?.limit ?? 50;
    const all = Array.from(getStore().lessonRuns.values()).filter(
      (r) =>
        r.learnerId === learnerId &&
        r.tenantId === tenantId &&
        (!opts?.status || r.status === opts.status),
    );
    return all
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, limit);
  },

  async countForLearner(learnerId, tenantId) {
    let n = 0;
    for (const r of getStore().lessonRuns.values()) {
      if (r.learnerId === learnerId && r.tenantId === tenantId) n += 1;
    }
    return n;
  },

  async getPlanById(planId, tenantId) {
    const p = getStore().generatedLessonPlans.get(planId);
    if (!p || p.tenantId !== tenantId) return null;
    return p;
  },

  async upsertPlan(plan: GeneratedLessonPlan) {
    getStore().generatedLessonPlans.set(plan.id, plan);
    return plan;
  },

  async appendInteraction(interaction: LessonInteraction) {
    getStore().lessonInteractions.push(interaction);
  },

  async listInteractions(lessonRunId, tenantId) {
    return getStore().lessonInteractions.filter(
      (i) => i.lessonRunId === lessonRunId && i.tenantId === tenantId,
    );
  },

  async upsertParentSummary(summary: ParentLessonSummary) {
    getStore().parentLessonSummaries.set(summary.id, summary);
    return summary;
  },

  async getParentSummaryForRun(lessonRunId, tenantId) {
    for (const s of getStore().parentLessonSummaries.values()) {
      if (s.lessonRunId === lessonRunId && s.tenantId === tenantId) return s;
    }
    return null;
  },
};
