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

/**
 * Wave C (G5) — per-tenant recommendation-approval delegation.
 *
 * Parents are ALWAYS authoritative. Districts may additionally delegate
 * approval to teachers (instructional types) and caregivers (regulation/
 * sensory types) via `district_settings.approval_policy`. B2C tenants have
 * no district_settings row, so they are parent-only by construction.
 * IEP-affecting recommendations are NEVER delegable.
 */
export interface RecommendationApprovalPolicy {
  teacherApproval: boolean;
  caregiverApproval: boolean;
}

export const DEFAULT_RECOMMENDATION_APPROVAL_POLICY: RecommendationApprovalPolicy = {
  teacherApproval: false,
  caregiverApproval: false,
};

/** Instructional types a district may delegate to teachers. */
export const TEACHER_APPROVABLE_RECOMMENDATION_TYPES: ReadonlySet<string> = new Set([
  "delivery_level_change",
  "tutor_strategy_change",
  "preferred_surface_change",
  "mastery_adjustment",
]);

/** Regulation/sensory types a district may delegate to caregivers. */
export const CAREGIVER_APPROVABLE_RECOMMENDATION_TYPES: ReadonlySet<string> = new Set([
  "self_regulation_support_add",
  "sensory_setting_change",
]);

export interface RecommendationApprovalContext {
  /** Recommendation type being decided (e.g. "delivery_level_change"). */
  recType?: string;
  /** IEP-affecting recommendations are parent-only, always. */
  affectsIep?: boolean;
  /** The tenant's delegation policy; defaults to parent-only. */
  policy?: RecommendationApprovalPolicy;
}

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

export function canApproveProfileRecommendation(
  role: TenantRole | undefined,
  ctx: RecommendationApprovalContext = {},
): boolean {
  if (!role) return false;
  // Parents are always authoritative — no policy can remove that.
  if (APPROVE_PROFILE_RECOMMENDATION_ROLES.has(role)) return true;
  // Everything below is delegation; IEP-affecting decisions never delegate.
  if (ctx.affectsIep) return false;
  const policy = ctx.policy ?? DEFAULT_RECOMMENDATION_APPROVAL_POLICY;
  if (role === "teacher") {
    return (
      policy.teacherApproval &&
      ctx.recType !== undefined &&
      TEACHER_APPROVABLE_RECOMMENDATION_TYPES.has(ctx.recType)
    );
  }
  if (role === "caregiver") {
    return (
      policy.caregiverApproval &&
      ctx.recType !== undefined &&
      CAREGIVER_APPROVABLE_RECOMMENDATION_TYPES.has(ctx.recType)
    );
  }
  return false;
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
