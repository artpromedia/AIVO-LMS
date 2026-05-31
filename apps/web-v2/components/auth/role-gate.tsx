import * as React from "react";
import {
  canAccessArea,
  getPermission,
  type NavArea,
  type RoleSession,
} from "@aivo/nav";

/**
 * `<RoleGate>` — server-renderable RBAC boundary for web shell routes.
 *
 * ADR 0020 (single shell, multi-role) requires every role-segmented
 * route on `apps/web-v2` to consult the canonical `canAccessArea`
 * decision so that the four outcomes — `allow`, `switch-role`,
 * `locked`, `forbidden` — are produced by the same helper the mobile
 * shell uses. This component is the thin web binding around that
 * helper.
 *
 * Usage (server component):
 * ```tsx
 * <RoleGate session={session} area="reports" pathname="/parent/reports">
 *   <ParentReports />
 * </RoleGate>
 * ```
 *
 * The default fallbacks render conservative HTML so that consumers can
 * adopt the gate without wiring up every locale + design-system slot
 * up front. Pass custom fallbacks to integrate with the design-system
 * `<LockedScreen>` / `<ForbiddenScreen>` and the role switcher route.
 *
 * The gate is intentionally **presentational**. For step-up enforcement
 * or hard server redirects, wrap the gate from a route handler /
 * layout that owns the `redirect()` call from `next/navigation` — the
 * gate's job is solely to compute and report the access decision so
 * the boundary stays testable in isolation.
 */
export interface RoleGateProps {
  /** The signed-in user's session (server-authoritative; from `GET /me`). */
  session: RoleSession;
  /** The nav area being entered. */
  area: NavArea;
  /**
   * Current pathname, used to build the `?next=` parameter on the
   * role-switch CTA so the user lands back on the same URL after a
   * successful switch. Required because the gate is server-rendered
   * and cannot read `usePathname()`.
   */
  pathname: string;
  /** Content rendered when the active role can reach `area`. */
  children: React.ReactNode;

  /**
   * Render override for the `switch-role` outcome. Receives the role
   * the user must switch to and the suggested switcher href.
   */
  renderSwitch?: (args: { requiredRole: string; switchHref: string }) => React.ReactNode;
  /**
   * Render override for the `locked` outcome. Receives the
   * server-declared lock reason (may be undefined for legacy entries).
   */
  renderLocked?: (args: { area: NavArea; lockReason?: string }) => React.ReactNode;
  /** Render override for the `forbidden` outcome. */
  renderForbidden?: (args: { area: NavArea }) => React.ReactNode;
}

const DEFAULT_SWITCH = ({
  requiredRole,
  switchHref,
}: {
  requiredRole: string;
  switchHref: string;
}) => (
  <div data-testid="role-gate-switch" role="status">
    <p>
      This area is available under your <strong>{requiredRole}</strong> role. Switch roles
      to continue.
    </p>
    <a href={switchHref}>Switch to {requiredRole}</a>
  </div>
);

const DEFAULT_LOCKED = ({
  area,
  lockReason,
}: {
  area: NavArea;
  lockReason?: string;
}) => (
  <div data-testid="role-gate-locked" role="status">
    <p>
      <strong>{area}</strong> is not available for your current role.
    </p>
    {lockReason ? <p>{lockReason}</p> : null}
  </div>
);

const DEFAULT_FORBIDDEN = ({ area }: { area: NavArea }) => (
  <div data-testid="role-gate-forbidden" role="alert">
    <p>You don&apos;t have access to {area}.</p>
  </div>
);

/**
 * Build the canonical role-switch href. Centralised so the BFF and the
 * client switcher can stay in sync if the route ever moves.
 */
export function buildRoleSwitchHref(targetRole: string, nextPath: string): string {
  const params = new URLSearchParams({ to: targetRole, next: nextPath });
  return `/role-switch?${params.toString()}`;
}

export function RoleGate(props: RoleGateProps): React.ReactElement {
  const {
    session,
    area,
    pathname,
    children,
    renderSwitch = DEFAULT_SWITCH,
    renderLocked = DEFAULT_LOCKED,
    renderForbidden = DEFAULT_FORBIDDEN,
  } = props;

  const decision = canAccessArea(session, area, "web");

  if (decision.outcome === "allow") {
    return <>{children}</>;
  }
  if (decision.outcome === "switch-role" && decision.requiredRole) {
    return (
      <>
        {renderSwitch({
          requiredRole: decision.requiredRole,
          switchHref: buildRoleSwitchHref(decision.requiredRole, pathname),
        })}
      </>
    );
  }
  if (decision.outcome === "locked") {
    const lockReason =
      decision.lockReason ?? getPermission(session.activeRole, area).lockReason;
    return <>{renderLocked({ area, lockReason })}</>;
  }
  return <>{renderForbidden({ area })}</>;
}
