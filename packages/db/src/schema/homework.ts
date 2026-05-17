import {
  pgTable,
  uuid,
  varchar,
  integer,
  numeric,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { learners } from "./learners.js";
import { homeworkModeEnum, homeworkStatusEnum } from "./enums.js";

export const homeworkAssignments = pgTable(
  "homework_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    learnerId: uuid("learner_id")
      .notNull()
      .references(() => learners.id, { onDelete: "cascade" }),
    subject: varchar("subject", { length: 128 }).notNull(),
    originalFileType: varchar("original_file_type", { length: 64 }),
    extractedText: varchar("extracted_text", { length: 65535 }),
    extractedProblems: jsonb("extracted_problems").notNull().default([]),
    adaptedProblems: jsonb("adapted_problems").notNull().default([]),
    homeworkMode: homeworkModeEnum("homework_mode").notNull(),
    status: homeworkStatusEnum("status").notNull().default("PROCESSING"),
    detectedSubject: varchar("detected_subject", { length: 64 }),
    subjectConfidence: numeric("subject_confidence", { precision: 3, scale: 2 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("homework_assignments_learner_id_idx").on(t.learnerId),
    index("homework_assignments_status_idx").on(t.status),
  ],
);

export const homeworkSessions = pgTable(
  "homework_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    homeworkAssignmentId: uuid("homework_assignment_id")
      .notNull()
      .references(() => homeworkAssignments.id, { onDelete: "cascade" }),
    learnerId: uuid("learner_id")
      .notNull()
      .references(() => learners.id, { onDelete: "cascade" }),
    tutorSku: varchar("tutor_sku", { length: 100 }),
    messages: jsonb("messages").notNull().default([]),
    completionQuality: numeric("completion_quality", { precision: 3, scale: 2 }),
    problemsAttempted: integer("problems_attempted").default(0),
    problemsCompleted: integer("problems_completed").default(0),
    hintsUsed: integer("hints_used").default(0),
    durationSeconds: integer("duration_seconds").default(0),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
  },
  (t) => [
    index("homework_sessions_assignment_id_idx").on(t.homeworkAssignmentId),
    index("homework_sessions_learner_id_idx").on(t.learnerId),
  ],
);

export const homeworkAssignmentsRelations = relations(homeworkAssignments, ({ one, many }) => ({
  learner: one(learners, { fields: [homeworkAssignments.learnerId], references: [learners.id] }),
  sessions: many(homeworkSessions),
}));

export const homeworkSessionsRelations = relations(homeworkSessions, ({ one }) => ({
  assignment: one(homeworkAssignments, { fields: [homeworkSessions.homeworkAssignmentId], references: [homeworkAssignments.id] }),
  learner: one(learners, { fields: [homeworkSessions.learnerId], references: [learners.id] }),
}));
