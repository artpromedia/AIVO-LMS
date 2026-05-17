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
export type { EnterpriseAuthOptions } from "./fastify-auth.js";

export {
  canReadLearnerProfile,
  canMutateLearnerProfile,
  canApproveProfileRecommendation,
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
