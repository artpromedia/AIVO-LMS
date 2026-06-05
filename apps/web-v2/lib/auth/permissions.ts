import {
  Permission,
  Role as SecurityRole,
  hasPermission as sharedHasPermission,
  permissionsForRole,
} from "@aivo/security";
import type { Role, SessionProfile } from "./types";

export const PLATFORM_STAFF_ROLES = [
  "support",
  "marketing",
  "sales",
  "devops",
  "engineering",
] as const;

export const PLATFORM_ROLES = ["platform_admin", ...PLATFORM_STAFF_ROLES] as const;

export const WEB_TO_SECURITY_ROLE: Record<Role, SecurityRole> = {
  parent: SecurityRole.PARENT,
  learner: SecurityRole.LEARNER,
  teacher: SecurityRole.TEACHER,
  caregiver: SecurityRole.CAREGIVER,
  therapist: SecurityRole.THERAPIST,
  school_admin: SecurityRole.SCHOOL_ADMIN,
  district_admin: SecurityRole.DISTRICT_ADMIN,
  platform_admin: SecurityRole.PLATFORM_ADMIN,
  support: SecurityRole.SUPPORT,
  marketing: SecurityRole.MARKETING,
  sales: SecurityRole.SALES,
  devops: SecurityRole.DEVOPS,
  engineering: SecurityRole.ENGINEERING,
};

export function securityRoleForWebRole(role: Role): SecurityRole {
  return WEB_TO_SECURITY_ROLE[role];
}

export function permissionsForWebRole(role: Role): string[] {
  return permissionsForRole(securityRoleForWebRole(role)).map((permission) => String(permission));
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
  permission: Permission | string,
): boolean {
  return sharedHasPermission(capabilitiesForSession(session), permission);
}

export function isPlatformRole(role: Role): role is (typeof PLATFORM_ROLES)[number] {
  return (PLATFORM_ROLES as readonly string[]).includes(role);
}
