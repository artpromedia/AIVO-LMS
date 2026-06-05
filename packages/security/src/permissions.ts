import { Role, isRole } from "./roles.js";

export enum Permission {
  All = "*",
  SelfRead = "self:read",
  SelfWrite = "self:write",
  LearnerRead = "learner:read",
  LearnerCreate = "learner:create",
  ClassRead = "class:read",
  ClassWrite = "class:write",
  AssignmentsRead = "assignments:read",
  AssignmentsWrite = "assignments:write",
  ReportsRead = "reports:read",
  BillingRead = "billing:read",
  PlatformRead = "platform:read",
  DistrictRead = "district:read",
  SchoolRead = "school:read",
  SchoolWrite = "school:write",
  SchoolCreate = "school:create",
  StaffRead = "staff:read",
  StaffProvision = "staff:provision",
  TeacherCreate = "teacher:create",
  UserRead = "user:read",
  UserManage = "user:manage",
  RoleGrant = "role:grant",
  TenantRead = "tenant:read",
  AuditRead = "audit:read",
  SecurityRead = "security:read",
  SupportRead = "support:read",
  CurriculumRead = "curriculum:read",
  AiRead = "ai:read",
}

export const rolePermissions: Record<Role, readonly Permission[]> = {
  [Role.PARENT]: [
    Permission.LearnerRead,
    Permission.LearnerCreate,
    Permission.ReportsRead,
    Permission.BillingRead,
  ],
  [Role.LEARNER]: [Permission.SelfRead, Permission.SelfWrite],
  [Role.TEACHER]: [
    Permission.ClassRead,
    Permission.ClassWrite,
    Permission.AssignmentsRead,
    Permission.AssignmentsWrite,
    Permission.LearnerRead,
    Permission.ReportsRead,
  ],
  [Role.CAREGIVER]: [Permission.LearnerRead],
  [Role.THERAPIST]: [Permission.LearnerRead, Permission.ReportsRead],
  [Role.PLATFORM_ADMIN]: [Permission.All],
  [Role.DISTRICT_ADMIN]: [
    Permission.DistrictRead,
    Permission.LearnerRead,
    Permission.SchoolRead,
    Permission.SchoolWrite,
    Permission.SchoolCreate,
    Permission.StaffRead,
    Permission.TeacherCreate,
    Permission.UserRead,
    Permission.UserManage,
    Permission.RoleGrant,
    Permission.ReportsRead,
  ],
  [Role.SCHOOL_ADMIN]: [
    Permission.LearnerRead,
    Permission.SchoolRead,
    Permission.SchoolWrite,
    Permission.StaffRead,
    Permission.TeacherCreate,
    Permission.LearnerCreate,
    Permission.UserRead,
    Permission.UserManage,
    Permission.RoleGrant,
    Permission.ReportsRead,
  ],
  [Role.SPED_LEAD]: [Permission.SchoolRead, Permission.LearnerRead, Permission.ReportsRead],
  [Role.SALES]: [Permission.PlatformRead, Permission.TenantRead, Permission.ReportsRead],
  [Role.MARKETING]: [Permission.PlatformRead, Permission.ReportsRead],
  [Role.CUSTOMER_CARE]: [Permission.PlatformRead, Permission.SupportRead, Permission.UserRead],
  [Role.SUPPORT]: [Permission.PlatformRead, Permission.SupportRead, Permission.UserRead],
  [Role.FINANCE]: [Permission.PlatformRead, Permission.BillingRead, Permission.ReportsRead],
  [Role.DEVOPS]: [
    Permission.PlatformRead,
    Permission.SecurityRead,
    Permission.AuditRead,
    Permission.TenantRead,
  ],
  [Role.ENGINEERING]: [
    Permission.PlatformRead,
    Permission.SecurityRead,
    Permission.AuditRead,
    Permission.AiRead,
    Permission.CurriculumRead,
  ],
};

export function permissionsForRole(role: Role | string | null | undefined): Permission[] {
  if (!isRole(role)) return [];
  return [...rolePermissions[role]];
}

export function permissionsForRoles(
  roles: readonly (Role | string | null | undefined)[],
): Permission[] {
  const out = new Set<Permission>();
  for (const role of roles) {
    for (const permission of permissionsForRole(role)) {
      out.add(permission);
    }
  }
  if (out.has(Permission.All)) return [Permission.All];
  return [...out];
}

export function hasPermission(
  roleOrPermissions: Role | string | readonly (Permission | string)[] | null | undefined,
  permission: Permission | string,
): boolean {
  const permissions: readonly (Permission | string)[] = Array.isArray(roleOrPermissions)
    ? roleOrPermissions
    : permissionsForRole(roleOrPermissions as Role | string | null | undefined);
  return permissions.includes(Permission.All) || permissions.includes(permission as Permission);
}
