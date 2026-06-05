import type { Role } from "@/lib/auth/types";
import { permissionsForWebRole } from "@/lib/auth/permissions";

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
const ALL_ROLES: Role[] = [
  "parent",
  "learner",
  "teacher",
  "caregiver",
  "therapist",
  "school_admin",
  "district_admin",
  "platform_admin",
  "support",
  "marketing",
  "sales",
  "devops",
  "engineering",
];

export const ROLE_PERMISSIONS = Object.fromEntries(
  ALL_ROLES.map((role) => [role, permissionsForWebRole(role)]),
) as Record<Role, readonly string[]>;

export function hasPermission(permissions: readonly string[], required: string): boolean {
  if (permissions.includes("*")) return true;
  return permissions.includes(required);
}
