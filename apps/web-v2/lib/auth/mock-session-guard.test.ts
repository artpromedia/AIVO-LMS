/**
 * Sprint A1 — the mock-session wrappers must refuse before reading cookies.
 *
 * `readMockSessionFromCookies()` and `getMockSession()` are the legacy
 * back-compat entry points around the guarded base readers. scripts/
 * auth-mode-audit.mjs requires each of them to call mockAuthAllowed()
 * explicitly (defense-in-depth on top of the guarded base readers), so a
 * forged `aivo_mock_session` cookie can never mint a session when
 * AUTH_MODE !== "mock".
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

// Real-auth mode: the wrappers must return null no matter what cookies say.
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

import { readMockSessionFromCookies, getMockSession, MOCK_COOKIE_NAME } from "./mock-session";
import { ACTIVE_ROLE_COOKIE, SESSION_ROLES_COOKIE } from "./role-session";

function requestWithCookies(cookies: Record<string, string>): Request {
  const header = Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
  return new Request("https://app.aivolearning.com/api/bff/health", {
    headers: { cookie: header },
  });
}

describe("mock-session wrappers on the real-auth path", () => {
  beforeEach(() => {
    cookieStore.clear();
  });

  it("readMockSessionFromCookies returns null even with a forged mock cookie", async () => {
    cookieStore.set(MOCK_COOKIE_NAME, "platform_admin");
    cookieStore.set(SESSION_ROLES_COOKIE, "teacher");
    cookieStore.set(ACTIVE_ROLE_COOKIE, "teacher");
    await expect(readMockSessionFromCookies()).resolves.toBeNull();
  });

  it("getMockSession returns null even with a forged mock cookie on the request", () => {
    const req = requestWithCookies({
      [MOCK_COOKIE_NAME]: "platform_admin",
      [SESSION_ROLES_COOKIE]: "teacher",
      [ACTIVE_ROLE_COOKIE]: "teacher",
    });
    expect(getMockSession(req)).toBeNull();
  });

  it("getMockSession returns null for an empty cookie header too", () => {
    expect(getMockSession(new Request("https://app.aivolearning.com/"))).toBeNull();
  });
});
