import { Permission } from "@aivo/security";
import type { SessionProfile } from "@/lib/auth/types";
import { capabilitiesForSession, sessionHasPermission } from "@/lib/auth/permissions";

export { Permission };

export function permissionsForSession(session: SessionProfile): string[] {
  return capabilitiesForSession(session);
}

export function hasBffPermission(
  session: SessionProfile,
  permission: Permission | string,
): boolean {
  return sessionHasPermission(session, permission);
}
