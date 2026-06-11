export type TenantRole =
  | "learner"
  | "parent"
  | "teacher"
  // Wave C (G5): caregivers participate in the recommendation-approval
  // flow (regulation/sensory types, district-delegated).
  | "caregiver"
  | "school_admin"
  | "district_admin"
  | "platform_admin"
  | "service";

export interface TenantContext {
  tenantId: string;
  districtId?: string;
  schoolId?: string;
  classId?: string;
  learnerId?: string;
  role: TenantRole;
}

export class MissingTenantContextError extends Error {
  constructor(message = "Tenant context is required for this operation") {
    super(message);
    this.name = "MissingTenantContextError";
  }
}

export function requireTenantContext(context: TenantContext | undefined | null): TenantContext {
  if (!context) {
    throw new MissingTenantContextError();
  }
  if (!context.tenantId || typeof context.tenantId !== "string") {
    throw new MissingTenantContextError("Tenant context is missing tenantId");
  }
  if (!context.role) {
    throw new MissingTenantContextError("Tenant context is missing role");
  }
  return context;
}

export function isFamilyOnlyTenant(context: TenantContext): boolean {
  return !context.districtId && !context.schoolId;
}
