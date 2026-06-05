import { cookies } from "next/headers";
import { serverEnv } from "@/lib/env";
import type { Role, SessionProfile } from "@/lib/auth/types";
import { capabilitiesForRole } from "@/lib/auth/permissions";
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
function mockProfile(
  role: Role,
  input: Omit<SessionProfile, "role" | "permissions" | "capabilities">,
): SessionProfile {
  const permissions = capabilitiesForRole(role);
  return {
    ...input,
    role,
    permissions,
    capabilities: permissions,
  };
}

export const MOCK_USERS: Record<Role, SessionProfile> = {
  parent: mockProfile("parent", {
    userId: "u_parent_1",
    tenantId: "t_demo",
    email: "parent@demo.aivo",
    displayName: "Riley Parent",
  }),
  learner: mockProfile("learner", {
    userId: "u_learner_1",
    tenantId: "t_demo",
    email: "learner@demo.aivo",
    displayName: "Sky",
    learnerId: "lrn_demo_sky",
  }),
  teacher: mockProfile("teacher", {
    userId: "u_teacher_1",
    tenantId: "t_demo",
    email: "teacher@demo.aivo",
    displayName: "Ms. Vega",
  }),
  school_admin: mockProfile("school_admin", {
    userId: "u_school_1",
    tenantId: "t_school_demo",
    email: "school@demo.aivo",
    displayName: "Pat Principal",
  }),
  district_admin: mockProfile("district_admin", {
    userId: "u_district_1",
    tenantId: "t_district_demo",
    email: "district@demo.aivo",
    displayName: "Dr. Chen",
  }),
  platform_admin: mockProfile("platform_admin", {
    userId: "u_platform_1",
    tenantId: "t_platform",
    email: "platform@demo.aivo",
    displayName: "AIVO Admin",
  }),
  support: mockProfile("support", {
    userId: "u_support_1",
    tenantId: "t_platform",
    email: "support@demo.aivo",
    displayName: "Alex Support",
  }),
  marketing: mockProfile("marketing", {
    userId: "u_marketing_1",
    tenantId: "t_platform",
    email: "marketing@demo.aivo",
    displayName: "Casey Marketing",
  }),
  sales: mockProfile("sales", {
    userId: "u_sales_1",
    tenantId: "t_platform",
    email: "sales@demo.aivo",
    displayName: "Jordan Sales",
  }),
  devops: mockProfile("devops", {
    userId: "u_devops_1",
    tenantId: "t_platform",
    email: "devops@demo.aivo",
    displayName: "Morgan DevOps",
  }),
  engineering: mockProfile("engineering", {
    userId: "u_engineering_1",
    tenantId: "t_platform",
    email: "engineering@demo.aivo",
    displayName: "Taylor Engineering",
  }),
  caregiver: mockProfile("caregiver", {
    userId: "u_caregiver_1",
    tenantId: "t_family_1",
    email: "caregiver@demo.aivo",
    displayName: "Sam Caregiver",
  }),
  therapist: mockProfile("therapist", {
    userId: "u_therapist_1",
    tenantId: "t_family_1",
    email: "therapist@demo.aivo",
    displayName: "Dr. Park",
  }),
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
      const permissions = capabilitiesForRole(requestedActive);
      return {
        ...swap,
        userId: base.userId,
        tenantId: base.tenantId,
        email: base.email,
        roles: heldRoles,
        permissions,
        capabilities: permissions,
      };
    }
    const permissions = capabilitiesForRole(requestedActive);
    return {
      ...base,
      role: requestedActive,
      roles: heldRoles,
      permissions,
      capabilities: permissions,
    };
  }

  const permissions = capabilitiesForRole(base.role);
  return {
    ...base,
    permissions,
    roles: heldRoles,
    capabilities: permissions,
  };
}
