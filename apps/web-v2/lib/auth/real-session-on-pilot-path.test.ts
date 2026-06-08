/**
 * G1 — no mock session on the pilot path.
 *
 * `readMockSessionFromCookies()` is the single session reader every
 * parent/district/learner server component uses. In a real-auth deployment
 * (AUTH_MODE !== "mock") it MUST ignore the mock cookie entirely and only
 * honor the real `aivo_session` snapshot written by the identity-svc-backed
 * login action. These tests pin that invariant so a future change can't let
 * a mock session leak onto a customer flow.
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

import {
  readMockSessionFromCookies,
  MOCK_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  isMockAuthAllowed,
} from "./mock-session";
import type { SessionProfile } from "./types";

function setCookie(name: string, value: string) {
  cookieStore.set(name, value);
}

function realSessionCookie(profile: SessionProfile): string {
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

describe("readMockSessionFromCookies — real-auth (pilot) mode", () => {
  beforeEach(() => {
    cookieStore.clear();
  });

  it("mock auth is disabled when AUTH_MODE !== mock", () => {
    expect(isMockAuthAllowed()).toBe(false);
  });

  it("ignores the mock cookie — a mock role can NOT mint a session", async () => {
    setCookie(MOCK_COOKIE_NAME, "district_admin");
    const session = await readMockSessionFromCookies();
    expect(session).toBeNull();
  });

  it("honors the real identity-svc session snapshot", async () => {
    setCookie(SESSION_COOKIE_NAME, realSessionCookie(pilotParent));
    const session = await readMockSessionFromCookies();
    expect(session).not.toBeNull();
    expect(session?.role).toBe("parent");
    expect(session?.userId).toBe("usr_pilot_parent");
    expect(session?.tenantId).toBe("tnt_pilot_district");
  });

  it("real session wins even when a stale mock cookie is also present", async () => {
    setCookie(MOCK_COOKIE_NAME, "platform_admin");
    setCookie(SESSION_COOKIE_NAME, realSessionCookie(pilotParent));
    const session = await readMockSessionFromCookies();
    // The real parent — not the mock platform_admin — is materialized.
    expect(session?.role).toBe("parent");
    expect(session?.userId).toBe("usr_pilot_parent");
  });

  it("returns null when no real session cookie is set", async () => {
    const session = await readMockSessionFromCookies();
    expect(session).toBeNull();
  });
});
