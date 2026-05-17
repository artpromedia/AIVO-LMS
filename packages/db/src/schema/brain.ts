import { pgTable, uuid, varchar, timestamp, jsonb, text, integer, real } from "drizzle-orm/pg-core";
import { brainApprovalStatusEnum, snapshotTriggerEnum, recommendationTypeEnum, recommendationStatusEnum, milestoneStatusEnum } from "./enums.js";
import { learners } from "./learners.js";
import { tenants } from "./tenants.js";

export const brainSeedTemplates = pgTable("brain_seed_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  gradeBand: varchar("grade_band", { length: 50 }).notNull(),
  functioningLevel: varchar("functioning_level", { length: 50 }).notNull(),
  template: jsonb("template").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const brainStates = pgTable("brain_states", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  learnerId: uuid("learner_id").references(() => learners.id).notNull(),
  masteryLevels: jsonb("mastery_levels").default({}),
  disabilitySignals: jsonb("disability_signals").default({}),
  functioningLevelProfile: jsonb("functioning_level_profile").default({}),
  iepProfile: jsonb("iep_profile").default({}),
  sensoryProfile: jsonb("sensory_profile").default({}),
  activeAccommodations: jsonb("active_accommodations").default([]),
  curriculumAlignment: jsonb("curriculum_alignment").default({}),
  activeTutors: jsonb("active_tutors").default([]),
  functionalCurriculum: jsonb("functional_curriculum").default({}),
  episodicMemory: jsonb("episodic_memory").default([]),
  visualIdentity: jsonb("visual_identity").default({}),
  approvalStatus: brainApprovalStatusEnum("approval_status").default("pending_parent_review"),
  xaiExplanation: jsonb("xai_explanation").default({}),
  parentNotes: text("parent_notes"),
  version: integer("version").default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const brainStateSnapshots = pgTable("brain_state_snapshots", {
  id: uuid("id").defaultRandom().primaryKey(),
  brainStateId: uuid("brain_state_id").references(() => brainStates.id).notNull(),
  learnerId: uuid("learner_id").references(() => learners.id).notNull(),
  version: integer("version").notNull(),
  trigger: snapshotTriggerEnum("trigger").notNull(),
  snapshot: jsonb("snapshot").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const brainRecommendations = pgTable("brain_recommendations", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  learnerId: uuid("learner_id").references(() => learners.id).notNull(),
  type: recommendationTypeEnum("type").notNull(),
  status: recommendationStatusEnum("status").default("PENDING"),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  payload: jsonb("payload").default({}),
  amendedPayload: jsonb("amended_payload"),
  appliedPayload: jsonb("applied_payload"),
  evidence: jsonb("evidence").default({}),
  sourceSignals: jsonb("source_signals").default([]),
  confidence: real("confidence"),
  applyError: text("apply_error"),
  appliedAt: timestamp("applied_at"),
  resolvedBy: uuid("resolved_by"),
  parentNotes: text("parent_notes"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const brainInsights = pgTable("brain_insights", {
  id: uuid("id").defaultRandom().primaryKey(),
  learnerId: uuid("learner_id").references(() => learners.id).notNull(),
  source: varchar("source", { length: 50 }).notNull(),
  sourceUserId: uuid("source_user_id"),
  insightText: text("insight_text").notNull(),
  domain: varchar("domain", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const functionalMilestones = pgTable("functional_milestones", {
  id: uuid("id").defaultRandom().primaryKey(),
  learnerId: uuid("learner_id").references(() => learners.id).notNull(),
  domain: varchar("domain", { length: 100 }).notNull(),
  milestone: varchar("milestone", { length: 255 }).notNull(),
  status: milestoneStatusEnum("status").default("not_started"),
  evidenceNotes: text("evidence_notes"),
  achievedAt: timestamp("achieved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const parentReportedEvents = pgTable("parent_reported_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  learnerId: uuid("learner_id").references(() => learners.id).notNull(),
  eventType: varchar("event_type", { length: 100 }).notNull(),
  description: text("description"),
  occurredAt: timestamp("occurred_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const causalAnalyses = pgTable("causal_analyses", {
  id: uuid("id").defaultRandom().primaryKey(),
  learnerId: uuid("learner_id").references(() => learners.id).notNull(),
  domain: varchar("domain", { length: 100 }).notNull(),
  masteryDrop: real("mastery_drop").notNull(),
  previousMastery: real("previous_mastery").notNull(),
  currentMastery: real("current_mastery").notNull(),
  detectedAt: timestamp("detected_at").defaultNow().notNull(),
  correlatedFactors: jsonb("correlated_factors").default([]),
  hypothesis: text("hypothesis"),
  confidence: real("confidence"),
  status: varchar("status", { length: 20 }).default("DETECTED").notNull(),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
