import { pgEnum } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", [
  "PARENT",
  "LEARNER",
  "TEACHER",
  "CAREGIVER",
  "THERAPIST",
  "PLATFORM_ADMIN",
  "DISTRICT_ADMIN",
  // School-scoped general admin. Manages teachers, classrooms, and
  // staff within a single school. Scoped via users.school_id; cannot
  // see other schools in the tenant.
  "SCHOOL_ADMIN",
  // School-scoped IEP admin (sprint task #12). Sits between
  // DISTRICT_ADMIN (district-wide) and TEACHER (per-learner). A
  // SPED_LEAD owns the IEP workflow inside one school: assigns case
  // managers, monitors draft pipeline, has sign-off authority below
  // the district level. Scoped via users.school_id.
  "SPED_LEAD",
  "SALES",
  "MARKETING",
  "CUSTOMER_CARE",
  "SUPPORT",
  "FINANCE",
  "DEVOPS",
  "ENGINEERING",
]);

export const tenantTypeEnum = pgEnum("tenant_type", ["B2C_FAMILY", "B2B_SCHOOL", "B2B_DISTRICT"]);

export const functioningLevelEnum = pgEnum("functioning_level", [
  "STANDARD",
  "SUPPORTED",
  "LOW_VERBAL",
  "NON_VERBAL",
  "PRE_SYMBOLIC",
]);

export const assessmentModeEnum = pgEnum("assessment_mode", [
  "STANDARD",
  "MODIFIED",
  "PICTURE_BASED",
  "SWITCH_SCAN",
  "PARTNER_ASSISTED",
  "OBSERVATIONAL",
]);

export const assessmentStatusEnum = pgEnum("assessment_status", [
  "NOT_STARTED",
  "IN_PROGRESS",
  "COMPLETED",
  "EXPIRED",
]);

export const recommendationTypeEnum = pgEnum("recommendation_type", [
  "brain_profile_review",
  "path_adjustment",
  "accommodation_add",
  "accommodation_remove",
  "goal_suggestion",
  "curriculum_shift",
  "rebaseline",
  "brain_upgrade",
  "regression_alert",
  "tutor_suggestion",
  "functioning_level_change",
  "iep_goal_met",
  "iep_refresh",
]);

export const recommendationStatusEnum = pgEnum("recommendation_status", [
  "PENDING",
  "APPROVED",
  "DECLINED",
  "ADJUSTED",
]);

export const brainApprovalStatusEnum = pgEnum("brain_approval_status", [
  "pending_parent_review",
  "approved",
  "amended",
  "declined",
]);

export const snapshotTriggerEnum = pgEnum("snapshot_trigger", [
  "initial_clone",
  "parent_approved",
  "parent_amended",
  "mastery_threshold",
  "rebaseline",
  "main_brain_upgrade",
  "tutor_addon_activated",
  "tutor_addon_deactivated",
]);

export const milestoneStatusEnum = pgEnum("milestone_status", [
  "not_started",
  "emerging",
  "developing",
  "achieved",
]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "ACTIVE",
  "PAST_DUE",
  "CANCELLED",
  "TRIALING",
]);

export const homeworkModeEnum = pgEnum("homework_mode", [
  "STANDARD",
  "SUPPORTED",
  "LOW_VERBAL",
  "NON_VERBAL",
  "PRE_SYMBOLIC",
]);

export const homeworkStatusEnum = pgEnum("homework_status", [
  "PROCESSING",
  "READY",
  "IN_PROGRESS",
  "COMPLETED",
  "FAILED",
]);
