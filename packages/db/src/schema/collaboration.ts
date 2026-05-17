import { pgTable, uuid, varchar, timestamp, text, jsonb } from "drizzle-orm/pg-core";
import { learners } from "./learners.js";
import { users } from "./users.js";
import { tenants } from "./tenants.js";

export const learnerTeachers = pgTable("learner_teachers", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  learnerId: uuid("learner_id").references(() => learners.id).notNull(),
  teacherEmail: varchar("teacher_email", { length: 255 }).notNull(),
  teacherUserId: uuid("teacher_user_id").references(() => users.id),
  invitedBy: uuid("invited_by").references(() => users.id).notNull(),
  status: varchar("status", { length: 20 }).default("PENDING").notNull(),
  role: varchar("role", { length: 50 }).default("teacher").notNull(),
  permissions: jsonb("permissions").default(["read_brain", "submit_insights"]),
  invitedAt: timestamp("invited_at").defaultNow().notNull(),
  acceptedAt: timestamp("accepted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const learnerCaregivers = pgTable("learner_caregivers", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  learnerId: uuid("learner_id").references(() => learners.id).notNull(),
  caregiverEmail: varchar("caregiver_email", { length: 255 }).notNull(),
  caregiverUserId: uuid("caregiver_user_id").references(() => users.id),
  invitedBy: uuid("invited_by").references(() => users.id).notNull(),
  relationship: varchar("relationship", { length: 100 }),
  status: varchar("status", { length: 20 }).default("PENDING").notNull(),
  permissions: jsonb("permissions").default(["read_summary", "submit_observations"]),
  invitedAt: timestamp("invited_at").defaultNow().notNull(),
  acceptedAt: timestamp("accepted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const learnerTherapists = pgTable("learner_therapists", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  learnerId: uuid("learner_id").references(() => learners.id).notNull(),
  therapistEmail: varchar("therapist_email", { length: 255 }).notNull(),
  therapistUserId: uuid("therapist_user_id").references(() => users.id),
  invitedBy: uuid("invited_by").references(() => users.id).notNull(),
  specialty: varchar("specialty", { length: 100 }),
  credentials: varchar("credentials", { length: 255 }),
  status: varchar("status", { length: 20 }).default("PENDING").notNull(),
  permissions: jsonb("permissions").default(["read_brain_hipaa", "therapy_goals", "submit_insights"]),
  invitedAt: timestamp("invited_at").defaultNow().notNull(),
  acceptedAt: timestamp("accepted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const therapyGoals = pgTable("therapy_goals", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  learnerId: uuid("learner_id").references(() => learners.id).notNull(),
  therapistId: uuid("therapist_id").references(() => learnerTherapists.id),
  goalText: text("goal_text").notNull(),
  domain: varchar("domain", { length: 100 }),
  baseline: varchar("baseline", { length: 255 }),
  targetCriteria: varchar("target_criteria", { length: 255 }),
  currentProgress: varchar("current_progress", { length: 255 }),
  status: varchar("status", { length: 20 }).default("active"),
  alignedIepGoalId: uuid("aligned_iep_goal_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const therapySessions = pgTable("therapy_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  learnerId: uuid("learner_id").references(() => learners.id).notNull(),
  therapistId: uuid("therapist_id").references(() => learnerTherapists.id),
  sessionDate: timestamp("session_date").notNull(),
  notes: text("notes"),
  goalsAddressed: jsonb("goals_addressed").default([]),
  progressUpdates: jsonb("progress_updates").default({}),
  duration: varchar("duration", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const caregiverObservations = pgTable("caregiver_observations", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  learnerId: uuid("learner_id").references(() => learners.id).notNull(),
  submittedBy: uuid("submitted_by").references(() => users.id).notNull(),
  category: varchar("category", { length: 100 }).default("General").notNull(),
  notes: text("notes").notNull(),
  mood: varchar("mood", { length: 50 }),
  date: timestamp("date").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const collaborationInvites = pgTable("collaboration_invites", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").references(() => tenants.id).notNull(),
  learnerId: uuid("learner_id").references(() => learners.id).notNull(),
  invitedBy: uuid("invited_by").references(() => users.id).notNull(),
  inviteeEmail: varchar("invitee_email", { length: 255 }).notNull(),
  role: varchar("role", { length: 50 }).notNull(),
  token: varchar("token", { length: 255 }).notNull(),
  status: varchar("status", { length: 20 }).default("PENDING").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
