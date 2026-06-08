/**
 * G1 — no mock session on the pilot path.
 *
 * `getSession()` (lib/auth/session.ts) is the single selector every
 * parent/district/learner server component reads through. In a real-auth
 * deployment (AUTH_MODE !== "mock") it MUST ignore the mock cookie entirely
 * and only return the real identity-svc session — the verified access-token
 * claims, or the httpOnly `aivo_session` snapshot web-v2 wrote at login. These
 * tests pin that invariant so a future change can't let a mock session leak
 * onto a customer flow.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

// Real-auth mode: env.ts refuses "mock" in production; "custom" is the
// production-grade provider value the district pilot harness runs under.
vi.mock("@/lib/env", () => ({
  serverEnv: { AUTH_MODE: "custom" },
}));

const cookieStore = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = cookieStore.get(name);
      return value === undefined ? undefined : { value };
    },
  }),
}));

import { getSession } from "./session";
import { MOCK_COOKIE_NAME, SESSION_COOKIE_NAME, isMockAuthAllowed } from "./mock-session";
import type { SessionProfile } from "./types";

function setCookie(name: string, value: string) {
  cookieStore.set(name, value);
}

function snapshot(profile: SessionProfile): string {
  return encodeURIComponent(JSON.stringify(profile));
}

const pilotParent: SessionProfile = {
  userId: "usr_pilot_parent",
  tenantId: "tnt_pilot_district",
  role: "parent",
  email: "parent@pilot.district",
  displayName: "Pilot Parent",
  permissions: [],
};

describe("getSession — real-auth (pilot) mode", () => {
  beforeEach(() => {
    cookieStore.clear();
  });

  it("mock auth is disabled when AUTH_MODE !== mock", () => {
    expect(isMockAuthAllowed()).toBe(false);
  });

  it("ignores the mock cookie — a mock role can NOT mint a session", async () => {
    setCookie(MOCK_COOKIE_NAME, "district_admin");
    const session = await getSession();
    expect(session).toBeNull();
  });

  it("honors the real identity-svc session snapshot", async () => {
    setCookie(SESSION_COOKIE_NAME, snapshot(pilotParent));
    const session = await getSession();
    expect(session).not.toBeNull();
    expect(session?.role).toBe("parent");
    expect(session?.userId).toBe("usr_pilot_parent");
    expect(session?.tenantId).toBe("tnt_pilot_district");
  });

  it("real session wins even when a stale mock cookie is also present", async () => {
    setCookie(MOCK_COOKIE_NAME, "platform_admin");
    setCookie(SESSION_COOKIE_NAME, snapshot(pilotParent));
    const session = await getSession();
    // The real parent — not the mock platform_admin — is materialized.
    expect(session?.role).toBe("parent");
    expect(session?.userId).toBe("usr_pilot_parent");
  });

  it("returns null when no real session cookie is set", async () => {
    const session = await getSession();
    expect(session).toBeNull();
  });
});
