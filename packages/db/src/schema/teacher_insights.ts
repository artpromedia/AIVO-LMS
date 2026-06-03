/**
 * Dedicated `teacher_insights` table — a focused per-teacher commentary
 * surface that backs the mobile (teacher)/student/[id]/insight.tsx screen
 * and the web `/api/bff/teacher/insights` parity route.
 *
 * Why a separate table from `brain_insights`:
 *   - `brain_insights` is a polyglot bucket fed by recommendations,
 *     IEP goals, and other sources; queries that need "just the teacher
 *     commentary timeline for learner X" had to filter every read.
 *   - Teacher insights need a tenant scope, a status (open / acknowledged
 *     / archived), and an optional learner-area tag (domain/subject)
 *     — fields the brain_insights schema doesn't carry.
 *
 * The family-svc handler writes to BOTH tables in the same transaction so
 * existing readers of `brain_insights` (recommendations, learner brain
 * profile) keep working without a migration sweep.
 */
import { pgTable, uuid, varchar, text, timestamp, index } from "drizzle-orm/pg-core";
import { tenants } from "./tenants.js";
import { learners } from "./learners.js";
import { users } from "./users.js";

export const teacherInsights = pgTable(
  "teacher_insights",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id)
      .notNull(),
    learnerId: uuid("learner_id")
      .references(() => learners.id)
      .notNull(),
    teacherUserId: uuid("teacher_user_id")
      .references(() => users.id)
      .notNull(),
    insightText: text("insight_text").notNull(),
    domain: varchar("domain", { length: 100 }),
    status: varchar("status", { length: 32 }).default("open").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    learnerIdx: index("idx_teacher_insights_learner").on(t.learnerId, t.createdAt),
    tenantIdx: index("idx_teacher_insights_tenant").on(t.tenantId, t.createdAt),
    teacherIdx: index("idx_teacher_insights_teacher").on(t.teacherUserId, t.createdAt),
  }),
);

export type TeacherInsight = typeof teacherInsights.$inferSelect;
export type NewTeacherInsight = typeof teacherInsights.$inferInsert;
