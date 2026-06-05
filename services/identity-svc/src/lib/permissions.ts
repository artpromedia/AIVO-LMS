import {
  ADMIN_ENTERPRISE,
  Permission,
  hasPermission,
  permissionsForRole,
} from "@aivo/security";

export function delegatedAdminRbacV2Enabled(): boolean {
  return ADMIN_ENTERPRISE.DELEGATED_ADMIN_RBAC_V2;
}

export function permissionsForCurrentRole(role: string): string[] {
  return permissionsForRole(role).map((permission) => String(permission));
}

export function requestHasPermission(
  payload: { role?: string | null; permissions?: readonly string[] | null } | null | undefined,
  permission: Permission | string,
): boolean {
  if (!payload?.role) return false;
  const effective = payload.permissions?.length
    ? payload.permissions
    : permissionsForCurrentRole(payload.role);
  return hasPermission(effective, permission);
}
