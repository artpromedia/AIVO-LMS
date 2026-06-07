import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  index,
  primaryKey,
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

// ── Curriculum catalogue (authoring/CMS write path, Sprint 4) ───────────
// Durable persistence for curriculum-svc when CURRICULUM_PERSISTENCE=postgres.
// Mirrors migration 0067_curriculum_catalogue.sql. See ADR 0040.

export const curriculumFrameworks = pgTable("curriculum_frameworks", {
  country: varchar("country", { length: 8 }).primaryKey(),
  framework: varchar("framework", { length: 256 }).notNull(),
  standardsCode: varchar("standards_code", { length: 64 }).notNull(),
  gradeBandScheme: varchar("grade_band_scheme", { length: 64 }).notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const curriculumJurisdictions = pgTable(
  "curriculum_jurisdictions",
  {
    id: varchar("id", { length: 128 }).primaryKey(),
    name: varchar("name", { length: 256 }).notNull(),
    state: varchar("state", { length: 64 }).notNull().default(""),
    country: varchar("country", { length: 8 }).notNull().default("US"),
    region: varchar("region", { length: 128 }),
    zipCodes: jsonb("zip_codes").notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("curriculum_jurisdictions_country_region_idx").on(t.country, t.region)],
);

export const curriculumSkills = pgTable(
  "curriculum_skills",
  {
    id: varchar("id", { length: 128 }).primaryKey(),
    subject: varchar("subject", { length: 64 }).notNull(),
    gradeBand: varchar("grade_band", { length: 32 }).notNull(),
    label: text("label").notNull().default(""),
    summary: text("summary").notNull().default(""),
    source: text("source").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("curriculum_skills_subject_grade_idx").on(t.subject, t.gradeBand)],
);

export const curriculumSkillPrereqs = pgTable(
  "curriculum_skill_prereqs",
  {
    skillId: varchar("skill_id", { length: 128 })
      .notNull()
      .references(() => curriculumSkills.id, { onDelete: "cascade" }),
    prereqSkillId: varchar("prereq_skill_id", { length: 128 }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.skillId, t.prereqSkillId] })],
);

export const curriculumContentPacks = pgTable(
  "curriculum_content_packs",
  {
    id: varchar("id", { length: 128 }).primaryKey(),
    title: varchar("title", { length: 256 }).notNull(),
    subject: varchar("subject", { length: 64 }).notNull(),
    gradeBand: varchar("grade_band", { length: 32 }).notNull(),
    frameworkCode: varchar("framework_code", { length: 64 }).notNull().default(""),
    districtIds: jsonb("district_ids").notNull().default([]),
    skillIds: jsonb("skill_ids").notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("curriculum_content_packs_subject_grade_idx").on(t.subject, t.gradeBand)],
);
