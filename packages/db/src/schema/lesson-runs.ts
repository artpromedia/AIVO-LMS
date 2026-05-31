/**
 * Lesson-run persistence tables.
 *
 * Backs the `LessonRunStore` (apps/web-v2/lib/db/persistence/types.ts):
 * lesson runs, their generated plans, per-step interactions, and the
 * plain-language parent summary produced on completion.
 *
 * Design notes:
 *  - IDs are application-generated opaque strings (`newId("lr")`, …), so
 *    they are stored as `text` primary keys rather than DB-generated
 *    UUIDs. For the same reason the learner/tenant/subject/skill columns
 *    are `text` (no FK references) — this domain store round-trips
 *    whatever id shape the caller supplies and must not couple to the
 *    uuid-keyed learner tables.
 *  - Timestamps are kept as ISO-8601 `text` so they round-trip verbatim
 *    and so `ORDER BY created_at DESC` is a chronological sort (ISO-8601
 *    UTC strings sort lexicographically).
 *  - The heavy nested snapshots / plan / summary payloads live in JSONB
 *    so the adapter can reconstruct the exact domain object.
 */
import { pgTable, text, integer, boolean, jsonb, index } from "drizzle-orm/pg-core";

export const lessonRuns = pgTable(
  "lesson_runs",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    learnerId: text("learner_id").notNull(),
    subjectId: text("subject_id"),
    skillId: text("skill_id"),
    source: text("source"),
    sourceRefId: text("source_ref_id"),
    tutorPersona: text("tutor_persona"),
    lessonPlanId: text("lesson_plan_id"),
    status: text("status").notNull(),
    retryCount: integer("retry_count").notNull().default(0),
    failureReason: text("failure_reason"),
    startedAt: text("started_at"),
    completedAt: text("completed_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    /** learnerContextSnapshot / masterySnapshot / accommodationSnapshot / brainStateSnapshot. */
    snapshots: jsonb("snapshots").notNull().default({}),
  },
  (t) => ({
    learnerIdx: index("lesson_runs_learner_idx").on(t.learnerId, t.tenantId),
    createdIdx: index("lesson_runs_created_idx").on(t.createdAt),
  }),
);

export const generatedLessonPlans = pgTable("generated_lesson_plans", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  lessonRunId: text("lesson_run_id"),
  /** Full GeneratedLessonPlan payload. */
  data: jsonb("data").notNull(),
});

export const lessonInteractions = pgTable(
  "lesson_interactions",
  {
    id: text("id").primaryKey(),
    lessonRunId: text("lesson_run_id").notNull(),
    learnerId: text("learner_id").notNull(),
    tenantId: text("tenant_id").notNull(),
    stepKind: text("step_kind").notNull(),
    stepRefId: text("step_ref_id"),
    response: text("response"),
    isCorrect: boolean("is_correct"),
    skipped: boolean("skipped").notNull().default(false),
    occurredAt: text("occurred_at").notNull(),
  },
  (t) => ({
    runIdx: index("lesson_interactions_run_idx").on(t.lessonRunId, t.tenantId),
  }),
);

export const lessonParentSummaries = pgTable(
  "lesson_parent_summaries",
  {
    id: text("id").primaryKey(),
    lessonRunId: text("lesson_run_id").notNull(),
    tenantId: text("tenant_id").notNull(),
    learnerId: text("learner_id").notNull(),
    /** Full ParentLessonSummary payload. */
    data: jsonb("data").notNull(),
  },
  (t) => ({
    runIdx: index("lesson_parent_summaries_run_idx").on(t.lessonRunId, t.tenantId),
  }),
);
