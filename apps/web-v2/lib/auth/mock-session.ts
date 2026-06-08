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

// Sprint 03 / G1 production guard. The env validator already refuses
// AUTH_MODE=mock in production, but a misconfigured deployment or a future
// caller that bypasses env.ts must still hit a hard NO before any mock session
// is materialized. This module is the MOCK half of the session selector in
// `lib/auth/session.ts`; the real identity-svc session lives in
// `lib/auth/identity-session.ts`. Returning null here is correct — the
// session-required helpers redirect to /login.
function mockAuthAllowed(): boolean {
  return serverEnv.AUTH_MODE === "mock";
}

// Mock users so role routing can be exercised end-to-end without a real
// identity provider. ONLY reachable when AUTH_MODE === "mock"; on the pilot
// path (AUTH_MODE !== "mock") these are never materialized.
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

// Historic name for the real-mode session snapshot cookie. Kept here (and
// re-exported) so existing importers (logout action, etc.) keep resolving; the
// canonical constant is `IDENTITY_SESSION_COOKIE` in identity-client.ts.
const REAL_SESSION_COOKIE = "aivo_session";

/**
 * Mock base-session reader (server component). MOCK MODE ONLY — returns null
 * the instant AUTH_MODE !== "mock", so a stray mock cookie can never mint a
 * session on the pilot path. Returns the BASE profile; the multi-role overlay
 * is applied centrally by `getSession()` in `lib/auth/session.ts`.
 */
export async function readMockBaseSession(): Promise<SessionProfile | null> {
  if (!mockAuthAllowed()) return null;
  const jar = await cookies();
  const role = parseRole(jar.get(COOKIE_NAME)?.value);
  return role ? MOCK_USERS[role] : null;
}

/** Edge-friendly mock base reader for Request-based callers. MOCK MODE ONLY. */
export function readMockBaseSessionFromRequest(req: Request): SessionProfile | null {
  if (!mockAuthAllowed()) return null;
  const header = req.headers.get("cookie") ?? "";
  for (const part of header.split(/;\s*/)) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    if (part.slice(0, eq) === COOKIE_NAME) {
      const role = parseRole(part.slice(eq + 1));
      return role ? MOCK_USERS[role] : null;
    }
  }
  return null;
}

/**
 * Back-compat wrappers (mock-only) that apply the multi-role overlay. The
 * canonical entry points are `getSession()` / `getRequestSession()` in
 * `lib/auth/session.ts`; these remain for legacy importers and unit tests.
 */
export async function readMockSessionFromCookies(): Promise<SessionProfile | null> {
  const base = await readMockBaseSession();
  if (!base) return null;
  const jar = await cookies();
  return applyMultiRoleOverlay(base, {
    extraRoles: parseSessionRolesCookie(jar.get(SESSION_ROLES_COOKIE)?.value),
    activeRole: parseActiveRoleCookie(jar.get(ACTIVE_ROLE_COOKIE)?.value),
  });
}

export function getMockSession(req: Request): SessionProfile | null {
  const base = readMockBaseSessionFromRequest(req);
  if (!base) return null;
  const header = req.headers.get("cookie") ?? "";
  const cookieMap = new Map<string, string>();
  for (const part of header.split(/;\s*/)) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    cookieMap.set(part.slice(0, eq), part.slice(eq + 1));
  }
  return applyMultiRoleOverlay(base, {
    extraRoles: parseSessionRolesCookie(cookieMap.get(SESSION_ROLES_COOKIE)),
    activeRole: parseActiveRoleCookie(cookieMap.get(ACTIVE_ROLE_COOKIE)),
  });
}

export const MOCK_COOKIE_NAME = COOKIE_NAME;
export const SESSION_COOKIE_NAME = REAL_SESSION_COOKIE;

/** Exposed for the mock-login route handler / selector to refuse cleanly. */
export function isMockAuthAllowed(): boolean {
  return mockAuthAllowed();
}

/**
 * Layer the multi-role cookies on top of a base session profile.
 *
 * - `extraRoles` becomes part of `profile.roles` (base role always first).
 * - `activeRole`, if it names a role the user actually holds, swaps the active
 *   role. In mock mode the underlying MOCK_USERS fixture is swapped (so the
 *   demo display name / permissions reflect the surface); in real mode only
 *   the role + permissions change, preserving the real user id / tenant id.
 *
 * Exported so the central selector (`lib/auth/session.ts`) applies one overlay
 * for both the mock and identity paths.
 */
export function applyMultiRoleOverlay(
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
