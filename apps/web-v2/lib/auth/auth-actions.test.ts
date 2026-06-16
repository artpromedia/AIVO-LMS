/**
 * Contract for the self-serve signup server action (`registerAction`):
 *  - the selected persona is forwarded verbatim to identity-svc for each of
 *    the four allowed roles (PARENT / TEACHER / SCHOOL_ADMIN / DISTRICT_ADMIN);
 *  - a tampered / unsupported `role` field falls back to PARENT so a crafted
 *    request can't escalate into a privileged role.
 *
 * The action ends in `redirect()` (which throws in Next), so each call is
 * expected to reject — the assertion is on what `identityRegister` received.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const redirectMock = vi.fn((url: string): never => {
  // Mirror next/navigation: redirect() halts execution by throwing.
  throw new Error(`NEXT_REDIRECT:${url}`);
});
vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}));

const cookieSet = vi.fn();
vi.mock("next/headers", () => ({
  cookies: async () => ({ set: cookieSet }),
}));

// Force a real (non-mock) auth mode so the action takes the identity-svc path.
vi.mock("@/lib/env", () => ({
  serverEnv: { AUTH_MODE: "custom" },
}));

const identityRegister = vi.fn();
const extractRefreshToken = vi.fn((..._a: unknown[]) => "refresh_tok");
const toSessionProfile = vi.fn();
vi.mock("@/lib/auth/identity-client", () => ({
  identityRegister: (...a: unknown[]) => identityRegister(...a),
  extractRefreshToken: (...a: unknown[]) => extractRefreshToken(...a),
  toSessionProfile: (...a: unknown[]) => toSessionProfile(...a),
}));

const setAuthSessionCookies = vi.fn();
vi.mock("@/lib/auth/session-cookies", () => ({
  setAuthSessionCookies: (...a: unknown[]) => setAuthSessionCookies(...a),
}));

import { registerAction } from "./auth-actions";

function signupForm(fields: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

const VALID = {
  name: "Sam Signup",
  email: "sam@example.com",
  password: "S3cure-Signup-Pass!9",
};

beforeEach(() => {
  vi.clearAllMocks();
  identityRegister.mockResolvedValue({
    kind: "ok",
    user: { id: "u_1", email: VALID.email, name: VALID.name, role: "PARENT", tenantId: "t_1" },
    accessToken: "access_tok",
    setCookies: [],
  });
  toSessionProfile.mockReturnValue({
    userId: "u_1",
    tenantId: "t_1",
    role: "parent",
    email: VALID.email,
    displayName: VALID.name,
    permissions: [],
  });
});

describe("registerAction role forwarding", () => {
  const ROLES = ["PARENT", "TEACHER", "SCHOOL_ADMIN", "DISTRICT_ADMIN"] as const;

  for (const role of ROLES) {
    it(`forwards the selected ${role} role to identity-svc`, async () => {
      await expect(registerAction(signupForm({ ...VALID, role }))).rejects.toThrow(/NEXT_REDIRECT/);
      expect(identityRegister).toHaveBeenCalledTimes(1);
      expect(identityRegister).toHaveBeenCalledWith(expect.objectContaining({ role }));
    });
  }

  it("forwards the chosen `next` destination on success", async () => {
    await expect(
      registerAction(signupForm({ ...VALID, role: "TEACHER", next: "/onboarding/invite/school" })),
    ).rejects.toThrow("NEXT_REDIRECT:/onboarding/invite/school");
    expect(setAuthSessionCookies).toHaveBeenCalledTimes(1);
  });
});

describe("registerAction role allowlist (no privilege escalation)", () => {
  it("falls back to PARENT for an unsupported/privileged role value", async () => {
    await expect(
      registerAction(signupForm({ ...VALID, role: "PLATFORM_ADMIN" })),
    ).rejects.toThrow(/NEXT_REDIRECT/);
    expect(identityRegister).toHaveBeenCalledWith(expect.objectContaining({ role: "PARENT" }));
  });

  it("falls back to PARENT when the role field is missing entirely", async () => {
    await expect(registerAction(signupForm({ ...VALID }))).rejects.toThrow(/NEXT_REDIRECT/);
    expect(identityRegister).toHaveBeenCalledWith(expect.objectContaining({ role: "PARENT" }));
  });
});

describe("registerAction identity-svc failure mapping (friendly error codes)", () => {
  // Each identity-svc failure status maps to a specific user-facing `error`
  // code that the signup page turns into a friendly message. A regression in
  // this mapping would silently show the wrong (or no) message on failure.
  const CASES = [
    { status: 409, code: "email_taken" },
    { status: 400, code: "weak_password" },
    { status: 502, code: "service_unavailable" },
    { status: 500, code: "signup_failed" },
    { status: undefined, code: "signup_failed" },
  ] as const;

  for (const { status, code } of CASES) {
    it(`redirects to the signup page with error=${code} for status ${status ?? "(none)"}`, async () => {
      identityRegister.mockResolvedValueOnce({ kind: "error", status });
      await expect(registerAction(signupForm({ ...VALID }))).rejects.toThrow(
        `NEXT_REDIRECT:/signup?error=${code}`,
      );
      expect(setAuthSessionCookies).not.toHaveBeenCalled();
    });
  }

  it("bounces back to the supplied errorReturn page on failure", async () => {
    identityRegister.mockResolvedValueOnce({ kind: "error", status: 409 });
    await expect(
      registerAction(signupForm({ ...VALID, errorReturn: "/onboarding/signup" })),
    ).rejects.toThrow("NEXT_REDIRECT:/onboarding/signup?error=email_taken");
  });

  it("redirects with error=unsupported_role when the session profile is null", async () => {
    toSessionProfile.mockReturnValueOnce(null);
    await expect(registerAction(signupForm({ ...VALID }))).rejects.toThrow(
      "NEXT_REDIRECT:/signup?error=unsupported_role",
    );
    expect(setAuthSessionCookies).not.toHaveBeenCalled();
  });
});

describe("registerAction client-side input validation (no identity-svc call)", () => {
  // Bad input must be rejected with error=invalid_input BEFORE any network
  // call, so identity-svc never sees a malformed registration.
  const BAD_INPUTS = [
    { label: "a too-short name", fields: { ...VALID, name: "A" } },
    { label: "a malformed email", fields: { ...VALID, email: "not-an-email" } },
    { label: "a too-short password", fields: { ...VALID, password: "short" } },
  ];

  for (const { label, fields } of BAD_INPUTS) {
    it(`rejects ${label} with error=invalid_input before calling identity-svc`, async () => {
      await expect(registerAction(signupForm(fields))).rejects.toThrow(
        "NEXT_REDIRECT:/signup?error=invalid_input",
      );
      expect(identityRegister).not.toHaveBeenCalled();
    });
  }
});
