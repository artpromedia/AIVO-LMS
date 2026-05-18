import { pgTable, uuid, varchar, timestamp, integer, jsonb, text, real } from "drizzle-orm/pg-core";
import { assessmentModeEnum, assessmentStatusEnum } from "./enums.js";
import { learners } from "./learners.js";
import { tenants } from "./tenants.js";
import { users } from "./users.js";

export const assessmentAttempts = pgTable("assessment_attempts", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .references(() => tenants.id)
    .notNull(),
  learnerId: uuid("learner_id")
    .references(() => learners.id)
    .notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  mode: assessmentModeEnum("mode").notNull().default("STANDARD"),
  status: assessmentStatusEnum("status").notNull().default("NOT_STARTED"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  domainScores: jsonb("domain_scores").default({}),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const assessmentResponses = pgTable("assessment_responses", {
  id: uuid("id").defaultRandom().primaryKey(),
  attemptId: uuid("attempt_id")
    .references(() => assessmentAttempts.id)
    .notNull(),
  questionId: varchar("question_id", { length: 100 }).notNull(),
  domain: varchar("domain", { length: 100 }),
  response: jsonb("response").notNull(),
  correct: integer("correct"),
  responseTimeMs: integer("response_time_ms"),
  confidence: real("confidence"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const parentAssessments = pgTable("parent_assessments", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .references(() => tenants.id)
    .notNull(),
  learnerId: uuid("learner_id")
    .references(() => learners.id)
    .notNull(),
  // Nullable on purpose: legacy rows pre-date caregiver attribution.
  // When present, `submittedBy` lets the baseline generator distinguish
  // parent from co-parent submissions and surface BOTH perspectives to
  // the LLM rather than letting last-write-wins silently drop one.
  submittedBy: uuid("submitted_by").references(() => users.id),
  communicationMode: varchar("communication_mode", { length: 50 }),
  deviceInteraction: varchar("device_interaction", { length: 50 }),
  responseMethod: varchar("response_method", { length: 50 }),
  attentionSpan: varchar("attention_span", { length: 50 }),
  diagnoses: jsonb("diagnoses").default([]),
  responses: jsonb("responses").default({}),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * Optional teacher-led intake feeding the adaptive baseline generator.
 * Every field except the FKs is nullable so a teacher can submit
 * whatever they have (e.g., classroom observations only, or strengths
 * + challenges only). The baseline LLM prompt degrades gracefully when
 * no row exists for the learner.
 */
export const teacherAssessments = pgTable("teacher_assessments", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .references(() => tenants.id)
    .notNull(),
  learnerId: uuid("learner_id")
    .references(() => learners.id)
    .notNull(),
  submittedBy: uuid("submitted_by").references(() => users.id),
  /** Free-text role label, e.g. "Special Ed Teacher", "General Ed Teacher". */
  teacherRole: varchar("teacher_role", { length: 100 }),
  gradeLevel: varchar("grade_level", { length: 20 }),
  subjectArea: varchar("subject_area", { length: 100 }),
  /** Classroom-observed strengths (array of short strings). */
  strengths: jsonb("strengths").default([]),
  /** Classroom-observed challenges (array of short strings). */
  challenges: jsonb("challenges").default([]),
  /** Accommodations the teacher uses or recommends (array). */
  accommodations: jsonb("accommodations").default([]),
  /** Free-form classroom observations narrative. */
  observations: text("observations"),
  /** Recommended baseline focus areas (array). */
  recommendedFocusAreas: jsonb("recommended_focus_areas").default([]),
  /** Free-form additional answers — same shape as parentAssessments.responses. */
  responses: jsonb("responses").default({}),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const observationalAssessments = pgTable("observational_assessments", {
  id: uuid("id").defaultRandom().primaryKey(),
  attemptId: uuid("attempt_id")
    .references(() => assessmentAttempts.id)
    .notNull(),
  observerId: uuid("observer_id"),
  checklist: jsonb("checklist").default({}),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * Per-learner *learning profile* artifact emitted by the adaptive
 * baseline. The grade-level placement (theta) is stored alongside the
 * more important fields — modality fit, processing speed, frustration
 * tolerance, attention pattern — that the tutor-runtime + parent
 * dashboard consume.
 *
 * One row per learner; the latest baseline replaces the previous one.
 */
export const learnerProfiles = pgTable("learner_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .references(() => tenants.id)
    .notNull(),
  learnerId: uuid("learner_id")
    .references(() => learners.id)
    .notNull()
    .unique(),
  /** Source attempt that produced this profile. */
  attemptId: uuid("attempt_id").references(() => assessmentAttempts.id),
  /** Final θ on the same logit scale as item difficulty. */
  thetaPlacement: real("theta_placement").notNull().default(0),
  /**
   * Ordered modality fit, e.g.
   *   [{ modality: "visual",   accuracy: 0.92, n: 6 },
   *    { modality: "auditory", accuracy: 0.71, n: 5 }, ...]
   */
  modalityFit: jsonb("modality_fit").notNull().default([]),
  /** Median time-to-respond on correct items, ms. */
  processingSpeedMs: integer("processing_speed_ms").notNull().default(0),
  /** 0…1 share of items where frustration / disengagement fired. */
  frustrationRate: real("frustration_rate").notNull().default(0),
  /** Items the learner sustained before the first frustration signal. */
  attentionRunLength: integer("attention_run_length").notNull().default(0),
  /** "low" / "moderate" / "high" — derived from frustrationRate. */
  frustrationTolerance: varchar("frustration_tolerance", { length: 16 })
    .notNull()
    .default("moderate"),
  /** Items administered to produce this profile. */
  itemsAdministered: integer("items_administered").notNull().default(0),
  baselineCompletedAt: timestamp("baseline_completed_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * In-flight adaptive baseline session state. One row per session; the
 * row is updated after every item until the session finalises into a
 * `learner_profiles` write.
 */
export const adaptiveBaselineSessions = pgTable("adaptive_baseline_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .references(() => tenants.id)
    .notNull(),
  learnerId: uuid("learner_id")
    .references(() => learners.id)
    .notNull(),
  /** "in_progress" | "completed" | "abandoned". */
  status: varchar("status", { length: 16 }).notNull().default("in_progress"),
  /** Serialized BaselineState (theta, infoSum, administered[], coveredSkills[]). */
  state: jsonb("state").notNull(),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
