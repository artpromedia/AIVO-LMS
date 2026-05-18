import type { TenantRole } from "./tenant-context.js";

const READ_LEARNER_PROFILE_ROLES = new Set<TenantRole>([
  "learner",
  "parent",
  "teacher",
  "school_admin",
  "district_admin",
  "platform_admin",
  "service",
]);

const MUTATE_LEARNER_PROFILE_ROLES = new Set<TenantRole>(["parent", "service"]);

const APPROVE_PROFILE_RECOMMENDATION_ROLES = new Set<TenantRole>(["parent"]);

const VIEW_DISTRICT_ANALYTICS_ROLES = new Set<TenantRole>([
  "school_admin",
  "district_admin",
  "platform_admin",
]);

const VIEW_AGGREGATE_BUT_NOT_PRIVATE_NOTES = new Set<TenantRole>([
  "school_admin",
  "district_admin",
]);

const SUBMIT_TEACHER_OBSERVATION_ROLES = new Set<TenantRole>(["teacher"]);

const MUTATE_BRAIN_GOVERNANCE_FIELDS = new Set<TenantRole>(["parent", "service"]);

export function canReadLearnerProfile(role: TenantRole | undefined): boolean {
  if (!role) return false;
  return READ_LEARNER_PROFILE_ROLES.has(role);
}

export function canMutateLearnerProfile(role: TenantRole | undefined): boolean {
  if (!role) return false;
  return MUTATE_LEARNER_PROFILE_ROLES.has(role);
}

export function canApproveProfileRecommendation(role: TenantRole | undefined): boolean {
  if (!role) return false;
  return APPROVE_PROFILE_RECOMMENDATION_ROLES.has(role);
}

export function canViewDistrictAnalytics(role: TenantRole | undefined): boolean {
  if (!role) return false;
  return VIEW_DISTRICT_ANALYTICS_ROLES.has(role);
}

export function canReadParentPrivateNotes(role: TenantRole | undefined): boolean {
  if (!role) return false;
  if (role === "parent" || role === "platform_admin") {
    return true;
  }
  return !VIEW_AGGREGATE_BUT_NOT_PRIVATE_NOTES.has(role);
}

export function canSubmitTeacherObservation(role: TenantRole | undefined): boolean {
  if (!role) return false;
  return SUBMIT_TEACHER_OBSERVATION_ROLES.has(role);
}

export function canMutateBrainGovernanceFields(role: TenantRole | undefined): boolean {
  if (!role) return false;
  return MUTATE_BRAIN_GOVERNANCE_FIELDS.has(role);
}

// ---- Sprint 08 district-mode helpers ----------------------------------

const MANAGE_DISTRICT_HIERARCHY_ROLES = new Set<TenantRole>(["district_admin", "platform_admin"]);

const MANAGE_SCHOOL_ROSTER_ROLES = new Set<TenantRole>([
  "school_admin",
  "district_admin",
  "platform_admin",
]);

const VIEW_CLASS_LEARNERS_ROLES = new Set<TenantRole>([
  "teacher",
  "school_admin",
  "district_admin",
  "platform_admin",
]);

const RUN_SIS_IMPORT_ROLES = new Set<TenantRole>(["district_admin", "platform_admin", "service"]);

const ACCEPT_DPA_ROLES = new Set<TenantRole>(["district_admin"]);

const EXPORT_DISTRICT_COMPLIANCE_ROLES = new Set<TenantRole>(["district_admin", "platform_admin"]);

export function canManageDistrictHierarchy(role: TenantRole | undefined): boolean {
  if (!role) return false;
  return MANAGE_DISTRICT_HIERARCHY_ROLES.has(role);
}

export function canManageSchoolRoster(role: TenantRole | undefined): boolean {
  if (!role) return false;
  return MANAGE_SCHOOL_ROSTER_ROLES.has(role);
}

export function canViewClassLearners(role: TenantRole | undefined): boolean {
  if (!role) return false;
  return VIEW_CLASS_LEARNERS_ROLES.has(role);
}

export function canRunSisImport(role: TenantRole | undefined): boolean {
  if (!role) return false;
  return RUN_SIS_IMPORT_ROLES.has(role);
}

export function canAcceptDpa(role: TenantRole | undefined): boolean {
  if (!role) return false;
  return ACCEPT_DPA_ROLES.has(role);
}

export function canExportDistrictCompliance(role: TenantRole | undefined): boolean {
  if (!role) return false;
  return EXPORT_DISTRICT_COMPLIANCE_ROLES.has(role);
}
