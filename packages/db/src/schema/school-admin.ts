import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  jsonb,
  text,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Durable persistence for the school-admin console (admin-svc).
 *
 * These tables replace the in-memory Maps that previously backed the
 * classroom CRUD, notification-preference matrix, and learner bulk-import
 * routes. `school_id` is stored as an opaque varchar (not a FK) because
 * the admin routes treat it as an externally supplied identifier and
 * finer school-ownership scoping is enforced at the BFF/identity layer.
 */

/**
 * Admin-managed classrooms. The id is an application-generated `cls_...`
 * string (kept for API stability), so the column is varchar rather than a
 * generated uuid. Teacher/co-teacher/learner membership is stored as
 * jsonb id arrays to mirror the route's wire contract one-to-one.
 */
export const adminClassrooms = pgTable(
  "admin_classrooms",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    schoolId: varchar("school_id", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    grade: varchar("grade", { length: 32 }),
    teacherIds: jsonb("teacher_ids").$type<string[]>().notNull().default([]),
    coTeacherIds: jsonb("co_teacher_ids").$type<string[]>().notNull().default([]),
    learnerIds: jsonb("learner_ids").$type<string[]>().notNull().default([]),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("idx_admin_classrooms_school").on(t.schoolId)],
);

/**
 * Per-school notification-preference matrix (event type × staff role →
 * email on/off). One row per school; the full matrix is stored as jsonb.
 */
export const adminNotificationPrefs = pgTable("admin_notification_prefs", {
  schoolId: varchar("school_id", { length: 255 }).primaryKey(),
  matrix: jsonb("matrix").$type<Record<string, Record<string, boolean>>>().notNull(),
  updatedBy: varchar("updated_by", { length: 64 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/**
 * Resumable learner bulk-import jobs. `progress` carries the chunked
 * engine's cursor so a crashed/redeployed worker can resume from the last
 * committed chunk instead of re-importing from scratch.
 */
export const learnerImportJobs = pgTable(
  "learner_import_jobs",
  {
    jobId: varchar("job_id", { length: 64 }).primaryKey(),
    schoolId: varchar("school_id", { length: 255 }).notNull(),
    status: varchar("status", { length: 16 }).notNull().default("pending"),
    progress: jsonb("progress").notNull(),
    errors: jsonb("errors").$type<string[] | null>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("idx_learner_import_jobs_school").on(t.schoolId)],
);

/**
 * Durable, idempotent destination for imported learner rows. Upserts are
 * keyed by (school_id, external_id) so re-running an import updates in
 * place rather than duplicating learners.
 */
export const learnerImportRecords = pgTable(
  "learner_import_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    schoolId: varchar("school_id", { length: 255 }).notNull(),
    externalId: varchar("external_id", { length: 255 }).notNull(),
    data: jsonb("data").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("idx_learner_import_records_unique").on(t.schoolId, t.externalId),
  ],
);

export type AdminClassroomRow = typeof adminClassrooms.$inferSelect;
export type AdminNotificationPrefRow = typeof adminNotificationPrefs.$inferSelect;
export type LearnerImportJobRow = typeof learnerImportJobs.$inferSelect;
export type LearnerImportRecordRow = typeof learnerImportRecords.$inferSelect;
