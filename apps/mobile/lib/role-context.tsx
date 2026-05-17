/**
 * RoleContext — Sprint 09 scaffolding for the unified mobile app.
 *
 * The legacy mobile app routes users into fragmented role groups
 * ((parent), (learner), (teacher), (caregiver), (therapist)). The
 * unified app is one signed-in shell where a user with multiple roles
 * (e.g. a parent who is also a teacher in their school) switches in
 * two taps without logging out.
 *
 * This module is the single source of truth for active role state on
 * device. It is consumed by:
 *   - apps/mobile/app/(app)/_layout.tsx — the unified shell (gated by
 *     MOBILE_UNIFIED_APP)
 *   - apps/mobile/components/RoleSwitcher.tsx
 *   - apps/mobile/lib/api.ts — appends the x-aivo-active-role header
 *     so the server can authorize per active role
 *
 * Until parity is reached, the legacy shells continue to ship. Server
 * authorization still gates everything by the role the access token
 * actually grants; x-aivo-active-role is a hint, never a privilege
 * grant.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { UserRole } from "@aivo/brand";

export type ActiveLearnerContext = {
  learnerId: string;
  displayName: string;
};

export interface RoleContextValue {
  /** Roles the signed-in user is entitled to act as. */
  availableRoles: UserRole[];
  /** The role the user is currently acting as. */
  activeRole: UserRole | null;
  /** Switch the active role. Throws if the role is not in
   *  `availableRoles`. */
  setActiveRole(role: UserRole): void;
  /** Last visited path per role; the role switcher restores it on
   *  re-entry so the user lands back where they left off. */
  lastPathByRole: Partial<Record<UserRole, string>>;
  rememberPath(role: UserRole, path: string): void;
  /** For roles that act on behalf of a specific learner (parent,
   *  teacher, caregiver, therapist), the currently selected learner.
   *  For `learner` role this is always the learner's own id. */
  activeLearner: ActiveLearnerContext | null;
  setActiveLearner(learner: ActiveLearnerContext | null): void;
}

const RoleContext = createContext<RoleContextValue | null>(null);

export interface RoleProviderProps {
  /** Roles the signed-in user is entitled to act as. */
  availableRoles: UserRole[];
  /** Initial active role; defaults to `availableRoles[0]`. */
  initialActiveRole?: UserRole;
  /** Initial active learner for roles that act on a learner. */
  initialActiveLearner?: ActiveLearnerContext | null;
  children: ReactNode;
}

export function RoleProvider({
  availableRoles,
  initialActiveRole,
  initialActiveLearner,
  children,
}: RoleProviderProps) {
  const [activeRole, setActiveRoleState] = useState<UserRole | null>(
    initialActiveRole ?? availableRoles[0] ?? null,
  );
  const [lastPathByRole, setLastPathByRole] = useState<
    Partial<Record<UserRole, string>>
  >({});
  const [activeLearner, setActiveLearner] = useState<ActiveLearnerContext | null>(
    initialActiveLearner ?? null,
  );

  const setActiveRole = useCallback(
    (role: UserRole) => {
      if (!availableRoles.includes(role)) {
        throw new Error(
          `[role-context] cannot activate role "${role}" — not in availableRoles.`,
        );
      }
      setActiveRoleState(role);
    },
    [availableRoles],
  );

  const rememberPath = useCallback((role: UserRole, path: string) => {
    setLastPathByRole((prev) => ({ ...prev, [role]: path }));
  }, []);

  const value = useMemo<RoleContextValue>(
    () => ({
      availableRoles,
      activeRole,
      setActiveRole,
      lastPathByRole,
      rememberPath,
      activeLearner,
      setActiveLearner,
    }),
    [
      availableRoles,
      activeRole,
      setActiveRole,
      lastPathByRole,
      rememberPath,
      activeLearner,
    ],
  );

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole(): RoleContextValue {
  const ctx = useContext(RoleContext);
  if (!ctx) {
    throw new Error("useRole must be used within RoleProvider");
  }
  return ctx;
}

/** Active-role header attached by `apps/mobile/lib/api.ts` on every
 *  authenticated request. The server treats this strictly as a hint —
 *  the actual authorization decision is made against the access
 *  token's role claims. See `services/identity-svc` for the active-role
 *  validator. */
export const ACTIVE_ROLE_HEADER = "x-aivo-active-role";
