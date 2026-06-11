export type { TenantContext, TenantRole } from "./tenant-context.js";
export {
  MissingTenantContextError,
  requireTenantContext,
  isFamilyOnlyTenant,
} from "./tenant-context.js";

export type { RequestContext, CreateRequestContextInput } from "./request-context.js";
export { createRequestContext } from "./request-context.js";

export type { AuditContext, BuildAuditContextInput } from "./audit-context.js";
export { buildAuditContext } from "./audit-context.js";

export { registerEnterpriseAuthHook } from "./fastify-auth.js";
export type { EnterpriseAuthOptions, ImpersonatedRequestAuditEvent } from "./fastify-auth.js";

export {
  isImpersonation,
  isWriteMethod,
  isImpersonationExpired,
  isRouteWriteAllowlisted,
  createImpWriteAllowlist,
  decideImpersonatedRequest,
} from "./impersonation-guard.js";
export type {
  ImpersonationClaimView,
  ImpWriteAllowEntry,
  ImpWriteAllowlist,
  ImpWriteDecision,
} from "./impersonation-guard.js";

export { registerGovernanceSubscriber } from "./governance-subscriber.js";
export type {
  GovernanceHandlers,
  GovernanceSubjectRequest,
  EraseResult,
  ExportResult,
} from "./governance-subscriber.js";

export {
  canReadLearnerProfile,
  canMutateLearnerProfile,
  canApproveProfileRecommendation,
  DEFAULT_RECOMMENDATION_APPROVAL_POLICY,
  TEACHER_APPROVABLE_RECOMMENDATION_TYPES,
  CAREGIVER_APPROVABLE_RECOMMENDATION_TYPES,
  canViewDistrictAnalytics,
  canReadParentPrivateNotes,
  canSubmitTeacherObservation,
  canMutateBrainGovernanceFields,
  canManageDistrictHierarchy,
  canManageSchoolRoster,
  canViewClassLearners,
  canRunSisImport,
  canAcceptDpa,
  canExportDistrictCompliance,
} from "./role-policy.js";
export type {
  RecommendationApprovalContext,
  RecommendationApprovalPolicy,
} from "./role-policy.js";
