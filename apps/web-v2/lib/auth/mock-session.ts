import { cookies } from "next/headers";
import { serverEnv } from "@/lib/env";
import type { Role, SessionProfile } from "@/lib/auth/types";
import {
  ACTIVE_ROLE_COOKIE,
  SESSION_ROLES_COOKIE,
  parseActiveRoleCookie,
  parseSessionRolesCookie,
} from "@/lib/auth/role-session";

const COOKIE_NAME = "aivo_mock_session";

// Sprint 03 production guard. The env validator already refuses
// AUTH_MODE=mock in production, but a misconfigured deployment or a
// future caller that bypasses env.ts must still hit a hard NO before any
// mock session is materialized. Returning null here is correct — the
// session-required helpers redirect to /login.
function mockAuthAllowed(): boolean {
  return serverEnv.AUTH_MODE === "mock";
}

// Mock users so role routing can be exercised end-to-end without a real
// identity provider. Replaced by Clerk/Auth.js/custom auth in a later sprint.
export const MOCK_USERS: Record<Role, SessionProfile> = {
  parent: {
    userId: "u_parent_1",
    tenantId: "t_demo",
    role: "parent",
    email: "parent@demo.aivo",
    displayName: "Riley Parent",
    permissions: ["learners:read", "learners:write"],
  },
  learner: {
    userId: "u_learner_1",
    tenantId: "t_demo",
    role: "learner",
    email: "learner@demo.aivo",
    displayName: "Sky",
    permissions: ["self:read"],
    learnerId: "lrn_demo_sky",
  },
  teacher: {
    userId: "u_teacher_1",
    tenantId: "t_demo",
    role: "teacher",
    email: "teacher@demo.aivo",
    displayName: "Ms. Vega",
    permissions: ["class:read", "class:write"],
  },
  school_admin: {
    userId: "u_school_1",
    tenantId: "t_school_demo",
    role: "school_admin",
    email: "school@demo.aivo",
    displayName: "Pat Principal",
    permissions: ["school:read", "school:write"],
  },
  district_admin: {
    userId: "u_district_1",
    tenantId: "t_district_demo",
    role: "district_admin",
    email: "district@demo.aivo",
    displayName: "Dr. Chen",
    permissions: ["district:read", "district:write"],
  },
  platform_admin: {
    userId: "u_platform_1",
    tenantId: "t_platform",
    role: "platform_admin",
    email: "platform@demo.aivo",
    displayName: "AIVO Admin",
    permissions: ["*"],
  },
  caregiver: {
    userId: "u_caregiver_1",
    tenantId: "t_family_1",
    role: "caregiver",
    email: "caregiver@demo.aivo",
    displayName: "Sam Caregiver",
    permissions: ["learner:read"],
  },
  therapist: {
    userId: "u_therapist_1",
    tenantId: "t_family_1",
    role: "therapist",
    email: "therapist@demo.aivo",
    displayName: "Dr. Park",
    permissions: ["learner:read"],
  },
};

function parseRole(value: string | undefined): Role | null {
  if (!value) return null;
  if (value in MOCK_USERS) return value as Role;
  return null;
}

// Real-mode session cookie set by the identity-svc-backed login server
// action. Stores a JSON snapshot of the user profile so server components
// can read the session without round-tripping to identity-svc on every
// render. Kept here (not in identity-client.ts) so the constant is safe
// to import from edge contexts that cannot reach the network client.
const REAL_SESSION_COOKIE = "aivo_session";

function parseRealSession(value: string | undefined): SessionProfile | null {
  if (!value) return null;
  try {
    const decoded = JSON.parse(decodeURIComponent(value)) as SessionProfile;
    if (!decoded || typeof decoded.role !== "string") return null;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Server-component / route-handler session reader.
 *
 * Mode-aware: in AUTH_MODE=mock it returns the canned MOCK_USERS profile
 * keyed by the mock cookie's role. In any other mode it parses the
 * real-auth session cookie set by the identity-svc-backed login action.
 *
 * Kept under the historic `readMockSessionFromCookies` name so the
 * dozens of existing call sites continue to work without churn.
 *
 * Phase 1 — Unified identity. The returned profile is augmented with
 *   - `roles`         : every role the user is entitled to act as,
 *                       drawn from {@link SESSION_ROLES_COOKIE} on top
 *                       of the base role.
 *   - `role` override : if {@link ACTIVE_ROLE_COOKIE} names one of the
 *                       roles in `roles`, it becomes the active role
 *                       and the underlying mock fixture is swapped to
 *                       that role's `MOCK_USERS` entry (so e.g.
 *                       `displayName` and `permissions` reflect the
 *                       active surface, not the original sign-in).
 */
export async function readMockSessionFromCookies(): Promise<SessionProfile | null> {
  const jar = await cookies();
  const baseProfile = mockAuthAllowed()
    ? (() => {
        const role = parseRole(jar.get(COOKIE_NAME)?.value);
        return role ? MOCK_USERS[role] : null;
      })()
    : parseRealSession(jar.get(REAL_SESSION_COOKIE)?.value);
  if (!baseProfile) return null;
  return applyMultiRoleOverlay(baseProfile, {
    extraRoles: parseSessionRolesCookie(jar.get(SESSION_ROLES_COOKIE)?.value),
    activeRole: parseActiveRoleCookie(jar.get(ACTIVE_ROLE_COOKIE)?.value),
  });
}

/** Edge-friendly variant for middleware / Request-based callers. */
export async function getMockSession(req: Request): Promise<SessionProfile | null> {
  const header = req.headers.get("cookie") ?? "";
  const cookieMap = new Map<string, string>();
  for (const part of header.split(/;\s*/)) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    cookieMap.set(part.slice(0, eq), part.slice(eq + 1));
  }
  const baseProfile = mockAuthAllowed()
    ? (() => {
        const role = parseRole(cookieMap.get(COOKIE_NAME));
        return role ? MOCK_USERS[role] : null;
      })()
    : parseRealSession(cookieMap.get(REAL_SESSION_COOKIE));
  if (!baseProfile) return null;
  return applyMultiRoleOverlay(baseProfile, {
    extraRoles: parseSessionRolesCookie(cookieMap.get(SESSION_ROLES_COOKIE)),
    activeRole: parseActiveRoleCookie(cookieMap.get(ACTIVE_ROLE_COOKIE)),
  });
}

export const MOCK_COOKIE_NAME = COOKIE_NAME;
export const SESSION_COOKIE_NAME = REAL_SESSION_COOKIE;

/** Exposed for the mock-login route handler to refuse cleanly. */
export function isMockAuthAllowed(): boolean {
  return mockAuthAllowed();
}

/**
 * Layer the multi-role cookies on top of the base session profile.
 *
 * - `extraRoles` becomes part of `profile.roles` (alongside the base
 *   role). Always deduped, base role always first.
 * - `activeRole`, if it names a role the user actually holds, swaps
 *   the underlying profile to that role's mock fixture so callers
 *   reading `session.role` get the active role and the corresponding
 *   `displayName` / `permissions` for that surface. The user id and
 *   tenant id from the *base* profile are preserved so audit trails
 *   stay stable across role switches.
 *
 * In real-auth mode `MOCK_USERS` lookups are not appropriate; we
 * simply update the `role` field. The `displayName` and `permissions`
 * are kept as-is — real-auth code paths refresh them via identity-svc
 * when needed.
 */
function applyMultiRoleOverlay(
  base: SessionProfile,
  overlay: { extraRoles: Role[]; activeRole: Role | null },
): SessionProfile {
  const heldRoles: Role[] = [base.role];
  const seen = new Set<Role>([base.role]);
  for (const r of overlay.extraRoles) {
    if (!seen.has(r)) {
      seen.add(r);
      heldRoles.push(r);
    }
  }

  const requestedActive = overlay.activeRole;
  if (requestedActive && requestedActive !== base.role && seen.has(requestedActive)) {
    if (mockAuthAllowed()) {
      const swap = MOCK_USERS[requestedActive];
      return {
        ...swap,
        userId: base.userId,
        tenantId: base.tenantId,
        email: base.email,
        roles: heldRoles,
        capabilities: [...swap.permissions],
      };
    }
    return {
      ...base,
      role: requestedActive,
      roles: heldRoles,
      capabilities: [...base.permissions],
    };
  }

  return {
    ...base,
    roles: heldRoles,
    capabilities: base.capabilities ?? [...base.permissions],
  };
}
