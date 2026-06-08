/**
 * Web-domain persistence tables.
 *
 * Backs the remaining domain stores in
 * apps/web-v2/lib/db/persistence/types.ts (notifications, audit,
 * identity, learners, assessments, curriculum, compliance, quests,
 * admin). These persist the web app's own domain objects verbatim and
 * are intentionally separate from the microservices' canonical tables —
 * which is why the `web_` prefix avoids any name collision.
 *
 * Conventions (matching lesson_runs / learner_brain_profiles):
 *  - App-generated opaque string ids → TEXT primary keys, no FK.
 *  - ISO-8601 TEXT timestamps so they round-trip verbatim.
 *  - The full domain object lives in a `data` JSONB column; columns
 *    exist only for the WHERE/ORDER predicates the stores actually use.
 *  - `seq BIGSERIAL` gives stable insertion order where the memory
 *    store relied on array push order.
 */
import { pgTable, text, integer, boolean, jsonb, bigserial, index } from "drizzle-orm/pg-core";

// ── notifications ───────────────────────────────────────────────────
export const webNotifications = pgTable(
  "web_notifications",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    userId: text("user_id").notNull(),
    readAt: text("read_at"),
    createdAt: text("created_at").notNull(),
    data: jsonb("data").notNull(),
  },
  (t) => ({ idx: index("web_notifications_user_idx").on(t.tenantId, t.userId) }),
);

export const webNotificationDeliveries = pgTable(
  "web_notification_deliveries",
  {
    id: text("id").primaryKey(),
    notificationId: text("notification_id").notNull(),
    data: jsonb("data").notNull(),
  },
  (t) => ({ idx: index("web_notif_deliveries_idx").on(t.notificationId) }),
);

// ── audit ───────────────────────────────────────────────────────────
export const webAuditLogs = pgTable(
  "web_audit_logs",
  {
    seq: bigserial("seq", { mode: "number" }).primaryKey(),
    tenantId: text("tenant_id"),
    data: jsonb("data").notNull(),
  },
  (t) => ({ idx: index("web_audit_logs_tenant_idx").on(t.tenantId, t.seq) }),
);

// ── identity ────────────────────────────────────────────────────────
export const webUsers = pgTable("web_users", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id"),
  data: jsonb("data").notNull(),
});

export const webMemberships = pgTable(
  "web_memberships",
  {
    seq: bigserial("seq", { mode: "number" }).primaryKey(),
    userId: text("user_id").notNull(),
    tenantId: text("tenant_id").notNull(),
    createdAt: text("created_at").notNull(),
    data: jsonb("data").notNull(),
  },
  (t) => ({
    userIdx: index("web_memberships_user_idx").on(t.userId),
    tenantIdx: index("web_memberships_tenant_idx").on(t.tenantId),
  }),
);

// ── learners ────────────────────────────────────────────────────────
export const webLearnerProfiles = pgTable(
  "web_learner_profiles",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    data: jsonb("data").notNull(),
  },
  (t) => ({ idx: index("web_learner_profiles_tenant_idx").on(t.tenantId) }),
);

export const webParentLearnerRelationships = pgTable(
  "web_parent_learner_relationships",
  {
    id: text("id").primaryKey(),
    seq: bigserial("seq", { mode: "number" }).notNull(),
    parentUserId: text("parent_user_id").notNull(),
    learnerId: text("learner_id").notNull(),
    tenantId: text("tenant_id").notNull(),
    data: jsonb("data").notNull(),
  },
  (t) => ({
    learnerIdx: index("web_plr_learner_idx").on(t.learnerId, t.tenantId),
    parentIdx: index("web_plr_parent_idx").on(t.parentUserId, t.tenantId),
  }),
);

// ── assessments ─────────────────────────────────────────────────────
export const webParentAssessments = pgTable(
  "web_parent_assessments",
  {
    id: text("id").primaryKey(),
    learnerId: text("learner_id").notNull(),
    tenantId: text("tenant_id").notNull(),
    data: jsonb("data").notNull(),
  },
  (t) => ({ idx: index("web_parent_assessments_idx").on(t.learnerId, t.tenantId) }),
);

export const webBaselineAssessments = pgTable(
  "web_baseline_assessments",
  {
    id: text("id").primaryKey(),
    learnerId: text("learner_id").notNull(),
    tenantId: text("tenant_id").notNull(),
    data: jsonb("data").notNull(),
  },
  (t) => ({ idx: index("web_baseline_assessments_idx").on(t.learnerId, t.tenantId) }),
);

export const webBaselineQuestions = pgTable(
  "web_baseline_questions",
  {
    id: text("id").primaryKey(),
    baselineId: text("baseline_id").notNull(),
    data: jsonb("data").notNull(),
  },
  (t) => ({ idx: index("web_baseline_questions_idx").on(t.baselineId) }),
);

export const webBaselineAttempts = pgTable(
  "web_baseline_attempts",
  {
    id: text("id").primaryKey(),
    seq: bigserial("seq", { mode: "number" }).notNull(),
    baselineId: text("baseline_id").notNull(),
    tenantId: text("tenant_id").notNull(),
    questionId: text("question_id").notNull(),
    learnerId: text("learner_id").notNull(),
    data: jsonb("data").notNull(),
  },
  (t) => ({
    baselineIdx: index("web_baseline_attempts_baseline_idx").on(t.baselineId, t.tenantId),
    pairIdx: index("web_baseline_attempts_pair_idx").on(t.questionId, t.learnerId),
  }),
);

export const webBaselineTelemetry = pgTable(
  "web_baseline_telemetry",
  {
    seq: bigserial("seq", { mode: "number" }).primaryKey(),
    tenantId: text("tenant_id").notNull(),
    learnerId: text("learner_id"),
    data: jsonb("data").notNull(),
  },
  (t) => ({ idx: index("web_baseline_telemetry_idx").on(t.tenantId) }),
);

// ── curriculum ──────────────────────────────────────────────────────
export const webSubjects = pgTable("web_subjects", {
  id: text("id").primaryKey(),
  data: jsonb("data").notNull(),
});

export const webSkills = pgTable(
  "web_skills",
  {
    id: text("id").primaryKey(),
    subjectId: text("subject_id"),
    data: jsonb("data").notNull(),
  },
  (t) => ({ idx: index("web_skills_subject_idx").on(t.subjectId) }),
);

export const webMasteryMaps = pgTable(
  "web_mastery_maps",
  {
    id: text("id").primaryKey(),
    learnerId: text("learner_id").notNull(),
    tenantId: text("tenant_id").notNull(),
    data: jsonb("data").notNull(),
  },
  (t) => ({ idx: index("web_mastery_maps_idx").on(t.learnerId, t.tenantId) }),
);

export const webSkillMasteries = pgTable(
  "web_skill_masteries",
  {
    id: text("id").primaryKey(),
    learnerId: text("learner_id").notNull(),
    tenantId: text("tenant_id").notNull(),
    data: jsonb("data").notNull(),
  },
  (t) => ({ idx: index("web_skill_masteries_idx").on(t.learnerId, t.tenantId) }),
);

export const webLearningPaths = pgTable(
  "web_learning_paths",
  {
    id: text("id").primaryKey(),
    learnerId: text("learner_id").notNull(),
    tenantId: text("tenant_id").notNull(),
    data: jsonb("data").notNull(),
  },
  (t) => ({ idx: index("web_learning_paths_idx").on(t.learnerId, t.tenantId) }),
);

// ── compliance ──────────────────────────────────────────────────────
export const webConsentRecords = pgTable(
  "web_consent_records",
  {
    id: text("id").primaryKey(),
    parentUserId: text("parent_user_id").notNull(),
    learnerId: text("learner_id"),
    tenantId: text("tenant_id").notNull(),
    data: jsonb("data").notNull(),
  },
  (t) => ({ idx: index("web_consent_records_idx").on(t.parentUserId, t.tenantId) }),
);

export const webIepDocuments = pgTable(
  "web_iep_documents",
  {
    id: text("id").primaryKey(),
    learnerId: text("learner_id").notNull(),
    tenantId: text("tenant_id").notNull(),
    data: jsonb("data").notNull(),
  },
  (t) => ({ idx: index("web_iep_documents_idx").on(t.learnerId, t.tenantId) }),
);

export const webAgeGateRecords = pgTable("web_age_gate_records", {
  // Keyed by learnerId, matching the memory store.
  learnerId: text("learner_id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  data: jsonb("data").notNull(),
});

export const webPolicyVersions = pgTable("web_policy_versions", {
  id: text("id").primaryKey(),
  data: jsonb("data").notNull(),
});

export const webSubprocessors = pgTable("web_subprocessors", {
  id: text("id").primaryKey(),
  data: jsonb("data").notNull(),
});

// ── quests ──────────────────────────────────────────────────────────
export const webQuestWorlds = pgTable("web_quest_worlds", {
  id: text("id").primaryKey(),
  data: jsonb("data").notNull(),
});

export const webQuestChapters = pgTable(
  "web_quest_chapters",
  {
    id: text("id").primaryKey(),
    worldId: text("world_id").notNull(),
    data: jsonb("data").notNull(),
  },
  (t) => ({ idx: index("web_quest_chapters_idx").on(t.worldId) }),
);

export const webQuestProgress = pgTable(
  "web_quest_progress",
  {
    id: text("id").primaryKey(),
    learnerId: text("learner_id").notNull(),
    tenantId: text("tenant_id").notNull(),
    data: jsonb("data").notNull(),
  },
  (t) => ({ idx: index("web_quest_progress_idx").on(t.learnerId, t.tenantId) }),
);

// ── admin ───────────────────────────────────────────────────────────
export const webSchools = pgTable(
  "web_schools",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    data: jsonb("data").notNull(),
  },
  (t) => ({ idx: index("web_schools_tenant_idx").on(t.tenantId) }),
);

export const webClassrooms = pgTable(
  "web_classrooms",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    data: jsonb("data").notNull(),
  },
  (t) => ({ idx: index("web_classrooms_tenant_idx").on(t.tenantId) }),
);

export const webEnrollments = pgTable(
  "web_enrollments",
  {
    id: text("id").primaryKey(),
    classroomId: text("classroom_id").notNull(),
    tenantId: text("tenant_id").notNull(),
    data: jsonb("data").notNull(),
  },
  (t) => ({
    classroomIdx: index("web_enrollments_classroom_idx").on(t.classroomId),
    tenantIdx: index("web_enrollments_tenant_idx").on(t.tenantId),
  }),
);

export const webTeacherAssignments = pgTable(
  "web_teacher_assignments",
  {
    id: text("id").primaryKey(),
    teacherId: text("teacher_id").notNull(),
    tenantId: text("tenant_id").notNull(),
    data: jsonb("data").notNull(),
  },
  (t) => ({ idx: index("web_teacher_assignments_idx").on(t.teacherId, t.tenantId) }),
);

// ===== Collaboration (Sprint 4) =====
// web-v2's own durable store for collaborator perspectives + accepted
// members, used by the pre-build invite step and the brain builder. Mirrors
// the family-svc backend in shape but lives in web-v2's database (the rest
// of web-v2 persistence is web_*), keeping the two stacks independent.
export const webCollaboratorInsights = pgTable(
  "web_collaborator_insights",
  {
    id: text("id").primaryKey(),
    learnerId: text("learner_id").notNull(),
    tenantId: text("tenant_id").notNull(),
    data: jsonb("data").notNull(),
  },
  (t) => ({ idx: index("web_collaborator_insights_idx").on(t.learnerId, t.tenantId) }),
);

export const webCollaboratorMembers = pgTable(
  "web_collaborator_members",
  {
    id: text("id").primaryKey(),
    learnerId: text("learner_id").notNull(),
    tenantId: text("tenant_id").notNull(),
    data: jsonb("data").notNull(),
  },
  (t) => ({ idx: index("web_collaborator_members_idx").on(t.learnerId, t.tenantId) }),
);
