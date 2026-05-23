import type { Role } from "@/lib/auth/types";

export type Tenant = {
  id: string;
  type: "family" | "school" | "district" | "platform";
  name: string;
  parentTenantId: string | null;
};

export type TenantMembership = {
  userId: string;
  tenantId: string;
  role: Role;
  permissions: string[];
};

export const MOCK_TENANTS: Record<string, Tenant> = {
  t_demo: {
    id: "t_demo",
    type: "family",
    name: "Demo Family",
    parentTenantId: "t_school_demo",
  },
  t_school_demo: {
    id: "t_school_demo",
    type: "school",
    name: "Westbrook Elementary",
    parentTenantId: "t_district_demo",
  },
  t_district_demo: {
    id: "t_district_demo",
    type: "district",
    name: "Westbrook Unified",
    parentTenantId: "t_platform",
  },
  t_platform: {
    id: "t_platform",
    type: "platform",
    name: "AIVO Platform",
    parentTenantId: null,
  },
};

export function getTenant(id: string): Tenant | null {
  return MOCK_TENANTS[id] ?? null;
}

/** Permission constants per role. Mirrors what real RBAC will issue later. */
export const ROLE_PERMISSIONS: Record<Role, readonly string[]> = {
  parent: ["learners:read", "learners:write", "reports:read", "billing:read"],
  learner: ["self:read", "self:write"],
  teacher: ["class:read", "class:write", "assignments:read", "assignments:write"],
  caregiver: ["learner:read"],
  therapist: ["learner:read", "reports:read"],
  school_admin: ["school:read", "school:write", "staff:read", "staff:write", "reports:read"],
  district_admin: ["district:read", "district:write", "schools:read", "reports:read"],
  platform_admin: ["*"],
};

export function hasPermission(permissions: readonly string[], required: string): boolean {
  if (permissions.includes("*")) return true;
  return permissions.includes(required);
}
