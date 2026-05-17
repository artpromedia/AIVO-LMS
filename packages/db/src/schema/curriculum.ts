import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { learners } from "./learners.js";
import { users } from "./users.js";
import { tenants } from "./tenants.js";

export const curriculumUploads = pgTable(
  "curriculum_uploads",
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
    sourceType: varchar("source_type", { length: 16 }).notNull(),
    fileName: varchar("file_name", { length: 255 }),
    mimeType: varchar("mime_type", { length: 100 }),
    rawText: text("raw_text"),
    parsedFocus: jsonb("parsed_focus").default({}),
    weekStart: timestamp("week_start", { withTimezone: true }),
    weekEnd: timestamp("week_end", { withTimezone: true }),
    status: varchar("status", { length: 24 }).notNull().default("PROCESSING"),
    notes: text("notes"),
    classGroupId: uuid("class_group_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("curriculum_uploads_learner_id_idx").on(t.learnerId),
    index("curriculum_uploads_subject_idx").on(t.subject),
    index("curriculum_uploads_status_idx").on(t.status),
    index("curriculum_uploads_class_group_idx").on(t.classGroupId),
  ],
);

export const curriculumUploadsRelations = relations(curriculumUploads, ({ one }) => ({
  learner: one(learners, {
    fields: [curriculumUploads.learnerId],
    references: [learners.id],
  }),
  uploader: one(users, {
    fields: [curriculumUploads.uploadedBy],
    references: [users.id],
  }),
}));
