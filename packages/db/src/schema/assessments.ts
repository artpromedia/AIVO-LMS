import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  integer,
  jsonb,
  text,
  real,
  boolean,
  index,
} from "drizzle-orm/pg-core";
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

/**
 * Therapist-led intake feeding the adaptive baseline generator
 * (adaptive-learning E2E Sprint 6). Mirrors teacherAssessments: every field
 * except learnerId is optional, multiple therapists (disciplines) may each
 * submit, and the prompt builder degrades gracefully when no row exists.
 */
export const therapistAssessments = pgTable("therapist_assessments", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .references(() => tenants.id)
    .notNull(),
  learnerId: uuid("learner_id")
    .references(() => learners.id)
    .notNull(),
  submittedBy: uuid("submitted_by").references(() => users.id),
  /** speech | occupational | behavioral | physical | other */
  therapyDiscipline: varchar("therapy_discipline", { length: 30 }),
  areasOfFocus: jsonb("areas_of_focus").default([]),
  strengths: jsonb("strengths").default([]),
  challenges: jsonb("challenges").default([]),
  sensoryNotes: text("sensory_notes"),
  communicationNotes: text("communication_notes"),
  regulationStrategies: jsonb("regulation_strategies").default([]),
  recommendedAccommodations: jsonb("recommended_accommodations").default([]),
  observations: text("observations"),
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
  /**
   * Set when a parent approves a rebaseline_request recommendation (or a
   * care-team effect requests one). The adaptive-baseline start seeds the
   * new run with the prior θ and finalization clears the marker.
   */
  rebaselineRequestedAt: timestamp("rebaseline_requested_at"),
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

/**
 * Per-item adaptive-baseline telemetry — one row per administered item,
 * capturing the ability estimate before/after the answer so the
 * recalibration job can refine item difficulty from live data. Append-only;
 * aggregated per `itemKey` (`${skillId}|${difficulty}`) across learners.
 */
export const baselineItemResponseLogs = pgTable(
  "baseline_item_response_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // Denormalized id columns (varchar, no FK): this is an append-only,
    // high-volume analytics log written from web-v2's string id space, so
    // it intentionally trades referential integrity for write simplicity.
    tenantId: varchar("tenant_id", { length: 128 }).notNull(),
    learnerId: varchar("learner_id", { length: 128 }).notNull(),
    /** Source baseline run. */
    baselineId: varchar("baseline_id", { length: 128 }).notNull(),
    /** Stable calibration key: `${skillId}|${difficulty}`. */
    itemKey: varchar("item_key", { length: 160 }).notNull(),
    skillId: varchar("skill_id", { length: 128 }).notNull(),
    subjectId: varchar("subject_id", { length: 128 }).notNull(),
    questionId: varchar("question_id", { length: 128 }).notNull(),
    /** Difficulty band: foundational | approaching | grade_level | stretch. */
    difficulty: varchar("difficulty", { length: 32 }).notNull(),
    /** Seed θ (`b`) the item was served at. */
    difficultyTheta: real("difficulty_theta").notNull(),
    correct: boolean("correct").notNull(),
    skipped: boolean("skipped").notNull().default(false),
    thetaBefore: real("theta_before").notNull(),
    thetaAfter: real("theta_after").notNull(),
    latencyMs: integer("latency_ms"),
    modality: varchar("modality", { length: 16 }).notNull(),
    recordedAt: timestamp("recorded_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_bir_tenant").on(table.tenantId),
    index("idx_bir_tenant_item").on(table.tenantId, table.itemKey),
    index("idx_bir_learner").on(table.learnerId),
    index("idx_bir_baseline").on(table.baselineId),
  ],
);

/**
 * Sprint 6 — AI-drafted IEPs derived from the baseline + parent
 * assessment. The status field tracks the review lifecycle:
 *
 *   ai_draft → teacher_review → admin_approved → active → archived
 *
 * The full draft body (goals, accommodations, services, rationale)
 * lives in `draft` as a JSONB blob so we can evolve the schema without
 * a destructive migration. Pinned at one ai_draft per learner —
 * regenerations replace the existing draft via upsert.
 */
export const iepDrafts = pgTable("iep_drafts", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id),
  learnerId: uuid("learner_id")
    .references(() => learners.id)
    .notNull(),
  /** Source attempt that fed the draft. Nullable when generated from
   *  parent assessment only (no completed baseline yet). */
  sourceAttemptId: uuid("source_attempt_id").references(() => assessmentAttempts.id),
  status: varchar("status", { length: 32 }).notNull().default("ai_draft"),
  /** Full draft body — goals[], accommodations[], services[], rationale, summary. */
  draft: jsonb("draft").notNull().default({}),
  /** LLM model that produced this draft (for audit/replay). */
  model: varchar("model", { length: 64 }),
  /** Responsible-AI verdict captured at generation time. */
  responsibleAi: jsonb("responsible_ai").default({}),
  generatedAt: timestamp("generated_at").defaultNow().notNull(),
  reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  approvedByUserId: uuid("approved_by_user_id").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/**
 * Sprint 4 — responsible-AI audit verdicts for AI-generated baseline
 * items. One row per evaluated question per generation attempt. Stored
 * so ops can dashboard the block rate, and so we can replay a baseline
 * to figure out why a learner saw or didn't see a particular item.
 *
 * Persistence is best-effort and parallel to the response shipped to
 * the client — a write failure does NOT block the baseline.
 */
export const baselineItemAudits = pgTable("baseline_item_audits", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id),
  learnerId: uuid("learner_id")
    .references(() => learners.id)
    .notNull(),
  /** Stable id of the question evaluated (e.g. `m3`). */
  questionId: varchar("question_id", { length: 200 }).notNull(),
  /** One of math / ela / science / speech / sel / life_skills / executive_function. */
  subject: varchar("subject", { length: 32 }).notNull(),
  /** "ai" | "ai_retry" | "fallback" — which generator produced the item. */
  source: varchar("source", { length: 16 }).notNull().default("ai"),
  /** Evaluator's recommendedAction — "allow" | "revise" | "block" | "escalate". */
  recommendedAction: varchar("recommended_action", { length: 16 }).notNull(),
  /** Evaluator's severity — "none" | "low" | "medium" | "high" | "critical". */
  severity: varchar("severity", { length: 16 }).notNull().default("none"),
  /** Whether the item shipped to the parent UI (allowed) or was swapped. */
  shipped: varchar("shipped", { length: 8 }).notNull().default("yes"),
  /** Compact violation array — codes + messages. Full evidence in `metadata`. */
  violations: jsonb("violations").notNull().default([]),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
