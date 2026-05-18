import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  integer,
  jsonb,
  text,
  real,
  pgEnum,
} from "drizzle-orm/pg-core";
import { learners } from "./learners.js";
import { tenants } from "./tenants.js";
import { users } from "./users.js";

export const sessionStatusEnum = pgEnum("session_status", [
  "STARTED",
  "CONTENT_GENERATING",
  "CONTENT_READY",
  "IN_PROGRESS",
  "COMPLETED",
  "ABANDONED",
]);

export const contentTypeEnum = pgEnum("content_type", [
  "LESSON",
  "PRACTICE",
  "REVIEW",
  "ASSESSMENT",
  "HOMEWORK",
]);

export const lessonSessions = pgTable("lesson_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .references(() => tenants.id)
    .notNull(),
  learnerId: uuid("learner_id")
    .references(() => learners.id)
    .notNull(),
  tutorSku: varchar("tutor_sku", { length: 100 }).notNull(),
  subject: varchar("subject", { length: 100 }).notNull(),
  status: sessionStatusEnum("status").default("STARTED"),
  contentType: contentTypeEnum("content_type").default("LESSON"),
  functioningLevel: varchar("functioning_level", { length: 30 }),
  deliveryLevel: varchar("delivery_level", { length: 30 }),
  brainContextSnapshot: jsonb("brain_context_snapshot").default({}),
  sessionData: jsonb("session_data").default({}),
  masteryBefore: jsonb("mastery_before").default({}),
  masteryAfter: jsonb("mastery_after").default({}),
  xpEarned: integer("xp_earned").default(0),
  durationSeconds: integer("duration_seconds").default(0),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const lessonContent = pgTable("lesson_content", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: uuid("session_id")
    .references(() => lessonSessions.id)
    .notNull(),
  contentType: contentTypeEnum("content_type").default("LESSON"),
  subject: varchar("subject", { length: 100 }).notNull(),
  topic: varchar("topic", { length: 255 }),
  gradeTarget: varchar("grade_target", { length: 20 }),
  deliveryLevel: varchar("delivery_level", { length: 20 }),
  generatedContent: jsonb("generated_content").default({}),
  qualityScore: real("quality_score"),
  qualityGateLog: jsonb("quality_gate_log").default({}),
  sensoryAdjustments: jsonb("sensory_adjustments").default({}),
  accommodations: jsonb("accommodations").default({}),
  promptTokens: integer("prompt_tokens").default(0),
  completionTokens: integer("completion_tokens").default(0),
  modelUsed: varchar("model_used", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const learningPaths = pgTable("learning_paths", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .references(() => tenants.id)
    .notNull(),
  learnerId: uuid("learner_id")
    .references(() => learners.id)
    .notNull(),
  subject: varchar("subject", { length: 100 }).notNull(),
  currentTopic: varchar("current_topic", { length: 255 }),
  topicSequence: jsonb("topic_sequence").default([]),
  completedTopics: jsonb("completed_topics").default([]),
  masteryMap: jsonb("mastery_map").default({}),
  curriculumAlignment: jsonb("curriculum_alignment").default({}),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const gradebookEntries = pgTable("gradebook_entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .references(() => tenants.id)
    .notNull(),
  learnerId: uuid("learner_id")
    .references(() => learners.id)
    .notNull(),
  subject: varchar("subject", { length: 100 }).notNull(),
  skill: varchar("skill", { length: 255 }).notNull(),
  masteryScore: real("mastery_score").default(0),
  attemptsCount: integer("attempts_count").default(0),
  lastAssessedAt: timestamp("last_assessed_at"),
  trend: varchar("trend", { length: 20 }).default("stable"),
  metadata: jsonb("metadata").default({}),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const tutorSessions = pgTable("tutor_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .references(() => tenants.id)
    .notNull(),
  learnerId: uuid("learner_id")
    .references(() => learners.id)
    .notNull(),
  tutorSku: varchar("tutor_sku", { length: 100 }).notNull(),
  tutorName: varchar("tutor_name", { length: 50 }).notNull(),
  sessionType: varchar("session_type", { length: 30 }).default("standard"),
  functioningLevel: varchar("functioning_level", { length: 30 }),
  messages: jsonb("messages").default([]),
  brainContext: jsonb("brain_context").default({}),
  skillsFocused: jsonb("skills_focused").default([]),
  masteryUpdates: jsonb("mastery_updates").default({}),
  xpEarned: integer("xp_earned").default(0),
  durationSeconds: integer("duration_seconds").default(0),
  completionQuality: real("completion_quality"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const tokenUsage = pgTable("token_usage", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .references(() => tenants.id)
    .notNull(),
  service: varchar("service", { length: 50 }).notNull(),
  model: varchar("model", { length: 100 }).notNull(),
  promptTokens: integer("prompt_tokens").default(0),
  completionTokens: integer("completion_tokens").default(0),
  totalTokens: integer("total_tokens").default(0),
  costCents: integer("cost_cents").default(0),
  requestType: varchar("request_type", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
