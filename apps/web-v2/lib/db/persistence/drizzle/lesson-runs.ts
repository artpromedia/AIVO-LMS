/**
 * Drizzle-backed LessonRunStore.
 *
 * Selected when AIVO_PERSISTENCE_LESSON_RUNS=postgres. Backed by the
 * `lesson_runs` / `generated_lesson_plans` / `lesson_interactions` /
 * `lesson_parent_summaries` tables (packages/db/src/schema/lesson-runs.ts,
 * migration 0047). Mirrors the memory store's semantics exactly:
 *   - listForLearner: newest-first by createdAt, optional status filter,
 *     default limit 50.
 *   - getRunById / getPlanById / getParentSummaryForRun: tenant-scoped.
 */
import { and, asc, count, desc, eq } from "drizzle-orm";
import {
  lessonRuns,
  generatedLessonPlans,
  lessonInteractions,
  lessonParentSummaries,
} from "@aivo/db";
import type {
  GeneratedLessonPlan,
  LessonInteraction,
  LessonRun,
  ParentLessonSummary,
} from "@/lib/db/types";
import type { LessonRunStore } from "../types";
import { getDb } from "./client";

type RunRow = typeof lessonRuns.$inferSelect;
type RunInsert = typeof lessonRuns.$inferInsert;
type InteractionRow = typeof lessonInteractions.$inferSelect;

function runToRow(run: LessonRun): RunInsert {
  return {
    id: run.id,
    tenantId: run.tenantId,
    learnerId: run.learnerId,
    subjectId: run.subjectId,
    skillId: run.skillId,
    source: run.source,
    sourceRefId: run.sourceRefId,
    tutorPersona: run.tutorPersona,
    lessonPlanId: run.lessonPlanId,
    status: run.status,
    retryCount: run.retryCount ?? 0,
    failureReason: run.failureReason,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    snapshots: {
      learnerContextSnapshot: run.learnerContextSnapshot,
      masterySnapshot: run.masterySnapshot,
      accommodationSnapshot: run.accommodationSnapshot,
      brainStateSnapshot: run.brainStateSnapshot,
    },
  };
}

function rowToRun(row: RunRow): LessonRun {
  const snaps = (row.snapshots ?? {}) as Record<string, unknown>;
  return {
    id: row.id,
    tenantId: row.tenantId,
    learnerId: row.learnerId,
    subjectId: row.subjectId ?? "",
    skillId: row.skillId ?? "",
    source: row.source as LessonRun["source"],
    sourceRefId: row.sourceRefId ?? null,
    tutorPersona: row.tutorPersona ?? "",
    learnerContextSnapshot: snaps.learnerContextSnapshot as LessonRun["learnerContextSnapshot"],
    masterySnapshot: snaps.masterySnapshot as LessonRun["masterySnapshot"],
    accommodationSnapshot: snaps.accommodationSnapshot as LessonRun["accommodationSnapshot"],
    brainStateSnapshot: snaps.brainStateSnapshot as LessonRun["brainStateSnapshot"],
    lessonPlanId: row.lessonPlanId ?? null,
    status: row.status as LessonRun["status"],
    retryCount: row.retryCount ?? 0,
    failureReason: row.failureReason ?? null,
    startedAt: row.startedAt ?? null,
    completedAt: row.completedAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function rowToInteraction(row: InteractionRow): LessonInteraction {
  return {
    id: row.id,
    lessonRunId: row.lessonRunId,
    learnerId: row.learnerId,
    tenantId: row.tenantId,
    stepKind: row.stepKind as LessonInteraction["stepKind"],
    stepRefId: row.stepRefId ?? null,
    response: row.response ?? null,
    isCorrect: row.isCorrect ?? null,
    skipped: row.skipped ?? false,
    occurredAt: row.occurredAt,
  };
}

export const drizzleLessonRuns: LessonRunStore = {
  async getRunById(lessonRunId, tenantId) {
    const db = getDb();
    const [row] = await db
      .select()
      .from(lessonRuns)
      .where(and(eq(lessonRuns.id, lessonRunId), eq(lessonRuns.tenantId, tenantId)))
      .limit(1);
    return row ? rowToRun(row) : null;
  },

  async upsertRun(run) {
    const db = getDb();
    const row = runToRow(run);
    const { id: _id, ...set } = row;
    await db.insert(lessonRuns).values(row).onConflictDoUpdate({ target: lessonRuns.id, set });
    return run;
  },

  async listForLearner(learnerId, tenantId, opts) {
    const db = getDb();
    const limit = opts?.limit ?? 50;
    const where = opts?.status
      ? and(
          eq(lessonRuns.learnerId, learnerId),
          eq(lessonRuns.tenantId, tenantId),
          eq(lessonRuns.status, opts.status),
        )
      : and(eq(lessonRuns.learnerId, learnerId), eq(lessonRuns.tenantId, tenantId));
    const rows = await db
      .select()
      .from(lessonRuns)
      .where(where)
      .orderBy(desc(lessonRuns.createdAt))
      .limit(limit);
    return rows.map(rowToRun);
  },

  async countForLearner(learnerId, tenantId) {
    const db = getDb();
    const [row] = await db
      .select({ n: count() })
      .from(lessonRuns)
      .where(and(eq(lessonRuns.learnerId, learnerId), eq(lessonRuns.tenantId, tenantId)));
    return Number(row?.n ?? 0);
  },

  async getPlanById(planId, tenantId) {
    const db = getDb();
    const [row] = await db
      .select()
      .from(generatedLessonPlans)
      .where(and(eq(generatedLessonPlans.id, planId), eq(generatedLessonPlans.tenantId, tenantId)))
      .limit(1);
    return row ? (row.data as GeneratedLessonPlan) : null;
  },

  async upsertPlan(plan: GeneratedLessonPlan) {
    const db = getDb();
    const values = {
      id: plan.id,
      tenantId: plan.tenantId,
      lessonRunId: plan.lessonRunId,
      data: plan,
    };
    await db
      .insert(generatedLessonPlans)
      .values(values)
      .onConflictDoUpdate({
        target: generatedLessonPlans.id,
        set: { tenantId: values.tenantId, lessonRunId: values.lessonRunId, data: values.data },
      });
    return plan;
  },

  async appendInteraction(interaction: LessonInteraction) {
    const db = getDb();
    await db
      .insert(lessonInteractions)
      .values({
        id: interaction.id,
        lessonRunId: interaction.lessonRunId,
        learnerId: interaction.learnerId,
        tenantId: interaction.tenantId,
        stepKind: interaction.stepKind,
        stepRefId: interaction.stepRefId,
        response: interaction.response,
        isCorrect: interaction.isCorrect,
        skipped: interaction.skipped,
        occurredAt: interaction.occurredAt,
      })
      .onConflictDoNothing({ target: lessonInteractions.id });
  },

  async listInteractions(lessonRunId, tenantId) {
    const db = getDb();
    const rows = await db
      .select()
      .from(lessonInteractions)
      .where(
        and(
          eq(lessonInteractions.lessonRunId, lessonRunId),
          eq(lessonInteractions.tenantId, tenantId),
        ),
      )
      .orderBy(asc(lessonInteractions.occurredAt));
    return rows.map(rowToInteraction);
  },

  async upsertParentSummary(summary: ParentLessonSummary) {
    const db = getDb();
    const values = {
      id: summary.id,
      lessonRunId: summary.lessonRunId,
      tenantId: summary.tenantId,
      learnerId: summary.learnerId,
      data: summary,
    };
    await db
      .insert(lessonParentSummaries)
      .values(values)
      .onConflictDoUpdate({
        target: lessonParentSummaries.id,
        set: {
          lessonRunId: values.lessonRunId,
          tenantId: values.tenantId,
          learnerId: values.learnerId,
          data: values.data,
        },
      });
    return summary;
  },

  async getParentSummaryForRun(lessonRunId, tenantId) {
    const db = getDb();
    const [row] = await db
      .select()
      .from(lessonParentSummaries)
      .where(
        and(
          eq(lessonParentSummaries.lessonRunId, lessonRunId),
          eq(lessonParentSummaries.tenantId, tenantId),
        ),
      )
      .limit(1);
    return row ? (row.data as ParentLessonSummary) : null;
  },
};
