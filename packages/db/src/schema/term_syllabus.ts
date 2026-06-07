/**
 * Whole-term / trimester syllabus persistence (Sprint 6, G7).
 *
 * A parent/teacher uploads a full-term syllabus per subject; ai-svc parses
 * it into an ordered scope-&-sequence (term_syllabus_units) that brain-svc's
 * pacing engine explodes into dated weekly foci. Mirrors migration
 * 0068_term_syllabus.sql.
 */
import { pgTable, uuid, varchar, text, integer, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { learners } from "./learners.js";
import { users } from "./users.js";
import { tenants } from "./tenants.js";

export const termSyllabi = pgTable(
  "term_syllabi",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").references(() => tenants.id),
    learnerId: uuid("learner_id")
      .notNull()
      .references(() => learners.id, { onDelete: "cascade" }),
    uploadedBy: uuid("uploaded_by")
      .notNull()
      .references(() => users.id),
    uploaderRole: varchar("uploader_role", { length: 32 }).notNull(),
    subject: varchar("subject", { length: 64 }).notNull(),
    title: varchar("title", { length: 255 }),
    termCount: integer("term_count").notNull().default(1),
    sourceType: varchar("source_type", { length: 16 }).notNull().default("text"),
    fileName: varchar("file_name", { length: 255 }),
    rawText: text("raw_text"),
    status: varchar("status", { length: 24 }).notNull().default("PARSED"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("term_syllabi_learner_subject_idx").on(t.learnerId, t.subject),
    index("term_syllabi_status_idx").on(t.status),
  ],
);

export const termSyllabusUnits = pgTable(
  "term_syllabus_units",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    syllabusId: uuid("syllabus_id")
      .notNull()
      .references(() => termSyllabi.id, { onDelete: "cascade" }),
    termNumber: integer("term_number").notNull().default(1),
    orderIndex: integer("order_index").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    durationWeeks: integer("duration_weeks").notNull().default(1),
    topics: jsonb("topics").notNull().default([]),
    objectives: jsonb("objectives").notNull().default([]),
    standards: jsonb("standards").notNull().default([]),
    vocabulary: jsonb("vocabulary").notNull().default([]),
    // Syllabus ↔ jurisdiction validation (Sprint 7, G8).
    validationStatus: varchar("validation_status", { length: 24 })
      .notNull()
      .default("unvalidated"),
    validationNotes: jsonb("validation_notes").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("term_syllabus_units_syllabus_idx").on(t.syllabusId, t.orderIndex)],
);

export const termSyllabiRelations = relations(termSyllabi, ({ one, many }) => ({
  learner: one(learners, {
    fields: [termSyllabi.learnerId],
    references: [learners.id],
  }),
  uploader: one(users, {
    fields: [termSyllabi.uploadedBy],
    references: [users.id],
  }),
  units: many(termSyllabusUnits),
}));

export const termSyllabusUnitsRelations = relations(termSyllabusUnits, ({ one }) => ({
  syllabus: one(termSyllabi, {
    fields: [termSyllabusUnits.syllabusId],
    references: [termSyllabi.id],
  }),
}));
