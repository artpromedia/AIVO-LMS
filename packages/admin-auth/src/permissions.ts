import type { Role, SessionProfile } from "./types.js";

type SecurityRole =
  | "PARENT"
  | "LEARNER"
  | "TEACHER"
  | "CAREGIVER"
  | "THERAPIST"
  | "SCHOOL_ADMIN"
  | "DISTRICT_ADMIN"
  | "PLATFORM_ADMIN"
  | "SUPPORT"
  | "MARKETING"
  | "SALES"
  | "DEVOPS"
  | "ENGINEERING"
  | "SPED_LEAD";

const ROLE_PERMISSIONS: Record<Role, readonly string[]> = {
  parent: ["learner:read", "learner:create", "reports:read", "billing:read"],
  learner: ["self:read", "self:write"],
  teacher: ["class:read", "class:write", "assignments:read", "assignments:write", "learner:read", "reports:read"],
  caregiver: ["learner:read"],
  therapist: ["learner:read", "reports:read"],
  school_admin: [
    "learner:read",
    "school:read",
    "school:write",
    "staff:read",
    "teacher:create",
    "learner:create",
    "user:read",
    "user:manage",
    "role:grant",
    "reports:read",
  ],
  district_admin: [
    "district:read",
    "learner:read",
    "school:read",
    "school:write",
    "school:create",
    "staff:read",
    "teacher:create",
    "user:read",
    "user:manage",
    "role:grant",
    "reports:read",
  ],
  platform_admin: ["*"],
  support: ["platform:read", "support:read", "user:read"],
  marketing: ["platform:read", "reports:read"],
  sales: ["platform:read", "tenant:read", "reports:read"],
  devops: ["platform:read", "security:read", "audit:read", "tenant:read"],
  engineering: ["platform:read", "security:read", "audit:read", "ai:read", "curriculum:read"],
};

export const PLATFORM_STAFF_ROLES = [
  "support",
  "marketing",
  "sales",
  "devops",
  "engineering",
] as const;

export const ADMIN_ROLES = [
  "school_admin",
  "district_admin",
  "platform_admin",
  ...PLATFORM_STAFF_ROLES,
] as const satisfies readonly Role[];

export const PLATFORM_ROLES = ["platform_admin", ...PLATFORM_STAFF_ROLES] as const;

const WEB_TO_SECURITY_ROLE: Record<Role, SecurityRole> = {
  parent: "PARENT",
  learner: "LEARNER",
  teacher: "TEACHER",
  caregiver: "CAREGIVER",
  therapist: "THERAPIST",
  school_admin: "SCHOOL_ADMIN",
  district_admin: "DISTRICT_ADMIN",
  platform_admin: "PLATFORM_ADMIN",
  support: "SUPPORT",
  marketing: "MARKETING",
  sales: "SALES",
  devops: "DEVOPS",
  engineering: "ENGINEERING",
};

export function isAdminRole(role: Role | string | null | undefined): role is (typeof ADMIN_ROLES)[number] {
  return (ADMIN_ROLES as readonly string[]).includes(String(role ?? ""));
}

export function isPlatformRole(role: Role | string | null | undefined): role is (typeof PLATFORM_ROLES)[number] {
  return (PLATFORM_ROLES as readonly string[]).includes(String(role ?? ""));
}

export function hasWriteAccess(session: Pick<SessionProfile, "role">): boolean {
  return session.role === "platform_admin" || session.role === "district_admin" || session.role === "school_admin";
}

export function securityRoleForWebRole(role: Role): SecurityRole {
  return WEB_TO_SECURITY_ROLE[role];
}

export function permissionsForWebRole(role: Role): string[] {
  return [...ROLE_PERMISSIONS[role]];
}

export function capabilitiesForRole(role: Role): string[] {
  return permissionsForWebRole(role);
}

export function capabilitiesForSession(
  session: Pick<SessionProfile, "role"> | Pick<SessionProfile, "role" | "permissions" | "capabilities">,
): string[] {
  return capabilitiesForRole(session.role);
}

export function sessionHasPermission(
  session: Pick<SessionProfile, "role"> | Pick<SessionProfile, "role" | "permissions" | "capabilities">,
  permission: string,
): boolean {
  const permissions = capabilitiesForSession(session);
  return permissions.includes("*") || permissions.includes(permission);
}
