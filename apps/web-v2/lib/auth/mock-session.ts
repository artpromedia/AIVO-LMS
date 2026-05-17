import { cookies } from "next/headers";
import { serverEnv } from "@/lib/env";
import type { Role, SessionProfile } from "@/lib/auth/types";

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
};

function parseRole(value: string | undefined): Role | null {
  if (!value) return null;
  if (value in MOCK_USERS) return value as Role;
  return null;
}

/** Server-component / route-handler session reader. */
export async function readMockSessionFromCookies(): Promise<SessionProfile | null> {
  if (!mockAuthAllowed()) return null;
  const jar = await cookies();
  const role = parseRole(jar.get(COOKIE_NAME)?.value);
  return role ? MOCK_USERS[role] : null;
}

/** Edge-friendly variant for middleware / Request-based callers. */
export async function getMockSession(req: Request): Promise<SessionProfile | null> {
  if (!mockAuthAllowed()) return null;
  const header = req.headers.get("cookie") ?? "";
  const match = header.split(/;\s*/).find((c) => c.startsWith(`${COOKIE_NAME}=`));
  const role = parseRole(match?.split("=")[1]);
  return role ? MOCK_USERS[role] : null;
}

export const MOCK_COOKIE_NAME = COOKIE_NAME;

/** Exposed for the mock-login route handler to refuse cleanly. */
export function isMockAuthAllowed(): boolean {
  return mockAuthAllowed();
}
