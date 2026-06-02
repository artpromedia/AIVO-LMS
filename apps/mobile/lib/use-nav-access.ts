/**
 * `useNavAccess(area)` — React hook that bridges the mobile
 * `RoleContext` to the canonical `canAccessArea` decision helper from
 * `@aivo/nav`.
 *
 * Mobile route guards (Expo Router `_layout.tsx` for each role
 * segment) call this hook to get the same four-outcome decision the
 * web `<RoleGate>` consumes — `allow` / `switch-role` / `locked` /
 * `forbidden` — so RBAC stays consistent across surfaces per ADR 0020.
 *
 * The hook returns `null` while the role context is still hydrating
 * (no active role, or active role lacks a brand→nav mapping); callers
 * should render a neutral loading state in that case.
 */
import { useMemo } from "react";
import type { AccessDecision, NavArea } from "@aivo/nav";
import { useRole } from "./role-context";
import { buildMobileRoleSession, getMobileNavAccess, toNavRole } from "./nav-access";

export interface UseNavAccessInput {
  area: NavArea;
  /** Stable user id from the server session. */
  userId: string;
  /** Tenant id from the server session. */
  tenantId: string;
  /** Capability claims granted by the server for the active role. */
  capabilities?: readonly string[];
}

export function useNavAccess(input: UseNavAccessInput): AccessDecision | null {
  const { activeRole, availableRoles } = useRole();

  return useMemo(() => {
    if (!activeRole) return null;
    if (!toNavRole(activeRole)) return null;
    const session = buildMobileRoleSession({
      id: input.userId,
      tenantId: input.tenantId,
      availableRoles,
      activeRole,
      capabilities: input.capabilities,
    });
    return getMobileNavAccess(session, input.area);
  }, [activeRole, availableRoles, input.area, input.userId, input.tenantId, input.capabilities]);
}
