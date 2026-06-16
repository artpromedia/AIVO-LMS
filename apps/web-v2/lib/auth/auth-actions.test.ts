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
const identityLogin = vi.fn();
const identityPinLogin = vi.fn();
const extractRefreshToken = vi.fn((..._a: unknown[]) => "refresh_tok");
const toSessionProfile = vi.fn();
vi.mock("@/lib/auth/identity-client", () => ({
  identityRegister: (...a: unknown[]) => identityRegister(...a),
  identityLogin: (...a: unknown[]) => identityLogin(...a),
  identityPinLogin: (...a: unknown[]) => identityPinLogin(...a),
  extractRefreshToken: (...a: unknown[]) => extractRefreshToken(...a),
  toSessionProfile: (...a: unknown[]) => toSessionProfile(...a),
}));

const setAuthSessionCookies = vi.fn();
vi.mock("@/lib/auth/session-cookies", () => ({
  setAuthSessionCookies: (...a: unknown[]) => setAuthSessionCookies(...a),
}));

import {
  registerAction,
  onboardingSignInAction,
  loginAction,
  learnerSignInAction,
} from "./auth-actions";

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
  identityLogin.mockResolvedValue({
    kind: "ok",
    user: { id: "u_1", email: VALID.email, name: VALID.name, role: "PARENT", tenantId: "t_1" },
    accessToken: "access_tok",
    setCookies: [],
  });
  identityPinLogin.mockResolvedValue({
    kind: "ok",
    user: {
      id: "u_learner_1",
      email: "learner@example.com",
      name: "Lee Learner",
      role: "LEARNER",
      tenantId: "t_1",
      learnerId: "learner_1",
    },
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

describe("registerAction open-redirect guard (safePath)", () => {
  // A crafted `next` must never turn the post-signup redirect into an open
  // redirect: off-site, protocol-relative, and non-path values are rejected
  // and the user is sent to the safe in-app fallback instead.
  const HOSTILE_NEXT = [
    { label: "an off-site absolute URL", value: "https://evil.example" },
    { label: "a protocol-relative URL", value: "//evil.example" },
    { label: "a javascript: scheme", value: "javascript:alert(1)" },
    { label: "a bare host (no leading slash)", value: "evil.example/path" },
    { label: "a backslash-prefixed path", value: "\\evil.example" },
  ];

  for (const { label, value } of HOSTILE_NEXT) {
    it(`ignores ${label} and redirects to the safe fallback`, async () => {
      await expect(
        registerAction(signupForm({ ...VALID, next: value })),
      ).rejects.toThrow("NEXT_REDIRECT:/onboarding/parent-setup");
      expect(setAuthSessionCookies).toHaveBeenCalledTimes(1);
    });
  }

  // The same guard protects `errorReturn`: a tampered value can't bounce the
  // failure redirect off-site — it falls back to the in-app /signup page.
  const HOSTILE_ERROR_RETURN = [
    { label: "an off-site absolute URL", value: "https://evil.example" },
    { label: "a protocol-relative URL", value: "//evil.example" },
    { label: "a javascript: scheme", value: "javascript:alert(1)" },
    { label: "a bare host (no leading slash)", value: "evil.example/path" },
  ];

  for (const { label, value } of HOSTILE_ERROR_RETURN) {
    it(`ignores ${label} in errorReturn and bounces to the safe /signup fallback`, async () => {
      identityRegister.mockResolvedValueOnce({ kind: "error", status: 409 });
      await expect(
        registerAction(signupForm({ ...VALID, errorReturn: value })),
      ).rejects.toThrow("NEXT_REDIRECT:/signup?error=email_taken");
      expect(setAuthSessionCookies).not.toHaveBeenCalled();
    });
  }
});

describe("registerAction identity-svc failure mapping (friendly error codes)", () => {
  // Each identity-svc failure status maps to a specific user-facing `error`
  // code that the signup page turns into a friendly message. A regression in
  // this mapping would silently show the wrong (or no) message on failure.
  const CASES = [
    { status: 409, code: "email_taken" },
    { status: 400, code: "weak_password" },
    { status: 502, code: "service_unavailable" },
    { status: 500, code: "service_unavailable" },
    { status: undefined, code: "service_unavailable" },
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

function signinForm(fields: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

const SIGNIN = { email: "sam@example.com", password: "S3cure-Signin-Pass!9" };

describe("onboardingSignInAction identity-svc failure mapping (friendly error codes)", () => {
  // Each identity-svc sign-in failure status maps to a specific user-facing
  // `error` code that the onboarding sign-in page turns into a friendly
  // message. A regression here would silently show the wrong (or no) message
  // to a user who fails to sign in.
  const CASES = [
    { status: 401, code: "invalid_credentials" },
    { status: 403, code: "wrong_surface" },
    { status: 500, code: "service_unavailable" },
    { status: 502, code: "service_unavailable" },
    { status: undefined, code: "service_unavailable" },
  ] as const;

  for (const { status, code } of CASES) {
    it(`redirects to the sign-in page with error=${code} for status ${status ?? "(none)"}`, async () => {
      identityLogin.mockResolvedValueOnce({ kind: "error", status });
      await expect(onboardingSignInAction(signinForm({ ...SIGNIN }))).rejects.toThrow(
        `NEXT_REDIRECT:/onboarding/signin?error=${code}`,
      );
      expect(setAuthSessionCookies).not.toHaveBeenCalled();
    });
  }

  it("bounces back to the supplied errorReturn page on failure", async () => {
    identityLogin.mockResolvedValueOnce({ kind: "error", status: 401 });
    await expect(
      onboardingSignInAction(signinForm({ ...SIGNIN, errorReturn: "/login" })),
    ).rejects.toThrow("NEXT_REDIRECT:/login?error=invalid_credentials");
  });

  it("redirects with error=unsupported_role when the session profile is null", async () => {
    toSessionProfile.mockReturnValueOnce(null);
    await expect(onboardingSignInAction(signinForm({ ...SIGNIN }))).rejects.toThrow(
      "NEXT_REDIRECT:/onboarding/signin?error=unsupported_role",
    );
    expect(setAuthSessionCookies).not.toHaveBeenCalled();
  });
});

describe("onboardingSignInAction open-redirect guard (safePath on `next`)", () => {
  // On a successful sign-in, a crafted `next` must never turn the post-login
  // redirect into an open redirect: off-site, protocol-relative, and non-path
  // values are rejected and the user lands on their safe role home instead
  // (ROLE_HOME["parent"] === "/parent/home").
  beforeEach(() => {
    identityLogin.mockResolvedValue({
      kind: "ok",
      user: { id: "u_1", email: SIGNIN.email, name: "Sam", role: "PARENT", tenantId: "t_1" },
      accessToken: "access_tok",
      setCookies: [],
    });
  });

  const HOSTILE_NEXT = [
    { label: "an off-site absolute URL", value: "https://evil.example" },
    { label: "a protocol-relative URL", value: "//evil.example" },
    { label: "a javascript: scheme", value: "javascript:alert(1)" },
    { label: "a bare host (no leading slash)", value: "evil.example/path" },
    { label: "a backslash-prefixed path", value: "\\evil.example" },
  ];

  for (const { label, value } of HOSTILE_NEXT) {
    it(`ignores ${label} and redirects to the safe role home`, async () => {
      await expect(
        onboardingSignInAction(signinForm({ ...SIGNIN, next: value })),
      ).rejects.toThrow("NEXT_REDIRECT:/parent/home");
      expect(setAuthSessionCookies).toHaveBeenCalledTimes(1);
    });
  }
});

describe("onboardingSignInAction open-redirect guard (safePath on `errorReturn`)", () => {
  // On a failed sign-in, a tampered `errorReturn` can't bounce the failure
  // redirect off-site — it falls back to the in-app /onboarding/signin page.
  const HOSTILE_ERROR_RETURN = [
    { label: "an off-site absolute URL", value: "https://evil.example" },
    { label: "a protocol-relative URL", value: "//evil.example" },
    { label: "a javascript: scheme", value: "javascript:alert(1)" },
    { label: "a bare host (no leading slash)", value: "evil.example/path" },
  ];

  for (const { label, value } of HOSTILE_ERROR_RETURN) {
    it(`ignores ${label} in errorReturn and bounces to the safe /onboarding/signin fallback`, async () => {
      identityLogin.mockResolvedValueOnce({ kind: "error", status: 401, error: "bad creds" });
      await expect(
        onboardingSignInAction(signinForm({ ...SIGNIN, errorReturn: value })),
      ).rejects.toThrow("NEXT_REDIRECT:/onboarding/signin?error=invalid_credentials");
      expect(setAuthSessionCookies).not.toHaveBeenCalled();
    });
  }
});

describe("onboardingSignInAction 403 surface redirect guard (isSafeSurfaceRedirect)", () => {
  // A 403 `redirectTo` is only honored when it points back into the AIVO
  // estate. An off-site `redirectTo` must be rejected — the user is NOT sent
  // there and instead falls back to the safe error page.
  const HOSTILE_REDIRECT_TO = [
    { label: "an off-site https URL", value: "https://evil.example/portal" },
    { label: "a protocol-relative URL", value: "//evil.example" },
    { label: "a non-https scheme on the apex", value: "http://aivolearning.com/portal" },
    { label: "a look-alike host", value: "https://aivolearning.com.evil.example" },
    { label: "a javascript: scheme", value: "javascript:alert(1)" },
  ];

  for (const { label, value } of HOSTILE_REDIRECT_TO) {
    it(`rejects ${label} and bounces to the safe error page instead`, async () => {
      identityLogin.mockResolvedValueOnce({
        kind: "error",
        status: 403,
        error: "wrong surface",
        redirectTo: value,
      });
      await expect(onboardingSignInAction(signinForm({ ...SIGNIN }))).rejects.toThrow(
        "NEXT_REDIRECT:/onboarding/signin?error=wrong_surface",
      );
      expect(setAuthSessionCookies).not.toHaveBeenCalled();
    });
  }

  it("honors a safe in-estate 403 redirectTo (guard allows the legitimate portal)", async () => {
    identityLogin.mockResolvedValueOnce({
      kind: "error",
      status: 403,
      error: "wrong surface",
      redirectTo: "https://admin.aivolearning.com/overview",
    });
    await expect(onboardingSignInAction(signinForm({ ...SIGNIN }))).rejects.toThrow(
      "NEXT_REDIRECT:https://admin.aivolearning.com/overview",
    );
    expect(setAuthSessionCookies).not.toHaveBeenCalled();
  });
});

describe("onboardingSignInAction missing-credential validation (no identity-svc call)", () => {
  // Missing email or password must be rejected with error=missing_credentials
  // BEFORE any network call, so identity-svc never sees an empty login.
  const MISSING: { label: string; fields: Record<string, string> }[] = [
    { label: "a missing email", fields: { password: SIGNIN.password } },
    { label: "a missing password", fields: { email: SIGNIN.email } },
    { label: "both credentials missing", fields: {} },
  ];

  for (const { label, fields } of MISSING) {
    it(`rejects ${label} with error=missing_credentials before calling identity-svc`, async () => {
      await expect(onboardingSignInAction(signinForm(fields))).rejects.toThrow(
        "NEXT_REDIRECT:/onboarding/signin?error=missing_credentials",
      );
      expect(identityLogin).not.toHaveBeenCalled();
    });
  }
});

describe("onboardingSignInAction MFA challenge branch", () => {
  it("stashes the MFA challenge cookie and redirects to /login/mfa", async () => {
    identityLogin.mockResolvedValueOnce({
      kind: "mfa",
      mfaToken: "mfa_tok_123",
      mfaMethod: "email",
    });
    await expect(onboardingSignInAction(signinForm({ ...SIGNIN }))).rejects.toThrow(
      "NEXT_REDIRECT:/login/mfa",
    );
    expect(cookieSet).toHaveBeenCalledTimes(1);
    const [cookieName, cookieValue] = cookieSet.mock.calls[0];
    expect(cookieName).toBe("aivo_mfa_challenge");
    expect(JSON.parse(decodeURIComponent(cookieValue as string))).toEqual({
      token: "mfa_tok_123",
      method: "email",
    });
    expect(setAuthSessionCookies).not.toHaveBeenCalled();
  });
});

describe("onboardingSignInAction safe-surface 403 redirect", () => {
  it("forwards to a safe same-origin redirectTo instead of error=wrong_surface", async () => {
    identityLogin.mockResolvedValueOnce({
      kind: "error",
      status: 403,
      redirectTo: "/admin/portal",
    });
    await expect(onboardingSignInAction(signinForm({ ...SIGNIN }))).rejects.toThrow(
      "NEXT_REDIRECT:/admin/portal",
    );
    expect(setAuthSessionCookies).not.toHaveBeenCalled();
  });

  it("falls back to error=wrong_surface when redirectTo is unsafe (off-site)", async () => {
    identityLogin.mockResolvedValueOnce({
      kind: "error",
      status: 403,
      redirectTo: "https://evil.example.com/phish",
    });
    await expect(onboardingSignInAction(signinForm({ ...SIGNIN }))).rejects.toThrow(
      "NEXT_REDIRECT:/onboarding/signin?error=wrong_surface",
    );
  });
});

describe("onboardingSignInAction successful sign-in", () => {
  it("redirects to the supplied next destination and sets session cookies", async () => {
    await expect(
      onboardingSignInAction(signinForm({ ...SIGNIN, next: "/onboarding/parent-setup" })),
    ).rejects.toThrow("NEXT_REDIRECT:/onboarding/parent-setup");
    expect(setAuthSessionCookies).toHaveBeenCalledTimes(1);
  });

  it("falls back to the role home when no next is supplied", async () => {
    await expect(onboardingSignInAction(signinForm({ ...SIGNIN }))).rejects.toThrow(
      "NEXT_REDIRECT:/parent/home",
    );
    expect(setAuthSessionCookies).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// loginAction — the canonical /login server action returning users hit most.
// It owns the same risky branches as onboardingSignInAction but always
// redirects back to the consumer /login surface (no errorReturn / next).
// ---------------------------------------------------------------------------

describe("loginAction identity-svc failure mapping (friendly error codes)", () => {
  // Each identity-svc sign-in failure status maps to a specific user-facing
  // `error` code that the /login page turns into a friendly message. A
  // regression here would silently show the wrong (or no) message to a user
  // who fails to log in.
  const CASES = [
    { status: 401, code: "invalid_credentials" },
    { status: 403, code: "wrong_surface" },
    { status: 500, code: "service_unavailable" },
    { status: 502, code: "service_unavailable" },
    { status: undefined, code: "service_unavailable" },
  ] as const;

  for (const { status, code } of CASES) {
    it(`redirects to /login with error=${code} for status ${status ?? "(none)"}`, async () => {
      identityLogin.mockResolvedValueOnce({ kind: "error", status });
      await expect(loginAction(signinForm({ ...SIGNIN }))).rejects.toThrow(
        `NEXT_REDIRECT:/login?error=${code}`,
      );
      expect(setAuthSessionCookies).not.toHaveBeenCalled();
    });
  }
});

describe("loginAction missing-credential validation (no identity-svc call)", () => {
  // Missing email or password must be rejected with error=missing_credentials
  // BEFORE any network call, so identity-svc never sees an empty login.
  const MISSING: { label: string; fields: Record<string, string> }[] = [
    { label: "a missing email", fields: { password: SIGNIN.password } },
    { label: "a missing password", fields: { email: SIGNIN.email } },
    { label: "both credentials missing", fields: {} },
  ];

  for (const { label, fields } of MISSING) {
    it(`rejects ${label} with error=missing_credentials before calling identity-svc`, async () => {
      await expect(loginAction(signinForm(fields))).rejects.toThrow(
        "NEXT_REDIRECT:/login?error=missing_credentials",
      );
      expect(identityLogin).not.toHaveBeenCalled();
    });
  }
});

describe("loginAction MFA challenge branch", () => {
  it("stashes the MFA challenge cookie and redirects to /login/mfa", async () => {
    identityLogin.mockResolvedValueOnce({
      kind: "mfa",
      mfaToken: "mfa_tok_123",
      mfaMethod: "email",
    });
    await expect(loginAction(signinForm({ ...SIGNIN }))).rejects.toThrow(
      "NEXT_REDIRECT:/login/mfa",
    );
    expect(cookieSet).toHaveBeenCalledTimes(1);
    const [cookieName, cookieValue] = cookieSet.mock.calls[0];
    expect(cookieName).toBe("aivo_mfa_challenge");
    expect(JSON.parse(decodeURIComponent(cookieValue as string))).toEqual({
      token: "mfa_tok_123",
      method: "email",
    });
    expect(setAuthSessionCookies).not.toHaveBeenCalled();
  });
});

describe("loginAction safe-surface 403 redirect", () => {
  it("forwards to a safe same-origin redirectTo instead of error=wrong_surface", async () => {
    identityLogin.mockResolvedValueOnce({
      kind: "error",
      status: 403,
      redirectTo: "/admin/portal",
    });
    await expect(loginAction(signinForm({ ...SIGNIN }))).rejects.toThrow(
      "NEXT_REDIRECT:/admin/portal",
    );
    expect(setAuthSessionCookies).not.toHaveBeenCalled();
  });

  it("falls back to error=wrong_surface when redirectTo is unsafe (off-site)", async () => {
    identityLogin.mockResolvedValueOnce({
      kind: "error",
      status: 403,
      redirectTo: "https://evil.example.com/phish",
    });
    await expect(loginAction(signinForm({ ...SIGNIN }))).rejects.toThrow(
      "NEXT_REDIRECT:/login?error=wrong_surface",
    );
  });
});

describe("loginAction unsupported-role and successful sign-in", () => {
  it("redirects with error=unsupported_role when the session profile is null", async () => {
    toSessionProfile.mockReturnValueOnce(null);
    await expect(loginAction(signinForm({ ...SIGNIN }))).rejects.toThrow(
      "NEXT_REDIRECT:/login?error=unsupported_role",
    );
    expect(setAuthSessionCookies).not.toHaveBeenCalled();
  });

  it("redirects to the role home and sets session cookies on success", async () => {
    await expect(loginAction(signinForm({ ...SIGNIN }))).rejects.toThrow(
      "NEXT_REDIRECT:/parent/home",
    );
    expect(setAuthSessionCookies).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// learnerSignInAction — the 4–6 digit PIN sign-in for learners on
// `/login?mode=learner`. Owns its own error/success mapping: the
// missing/invalid-input guard, the identity-svc PIN failure →
// invalid_credentials mapping, the profile guard (unsupported_role for a
// null profile / wrong role / learnerId mismatch), and the successful
// redirect to /learner/home with session cookies set. A regression here
// could show the wrong (or no) message to a child, or — worse — mint a
// learner session for a mismatched profile.
// ---------------------------------------------------------------------------

function pinForm(fields: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

const PIN = { parentId: "parent_1", learnerId: "learner_1", pin: "1234" };

const LEARNER_PROFILE = {
  userId: "u_learner_1",
  tenantId: "t_1",
  role: "learner",
  email: "learner@example.com",
  displayName: "Lee Learner",
  permissions: [],
  learnerId: "learner_1",
};

describe("learnerSignInAction missing/invalid-input validation (no identity-svc call)", () => {
  // A missing parentId/learnerId or a PIN that isn't 4–6 digits must be
  // rejected with error=missing_credentials BEFORE any identity-svc call,
  // so the PIN endpoint never sees a malformed sign-in.
  const BAD: { label: string; fields: Record<string, string> }[] = [
    { label: "a missing parentId", fields: { learnerId: PIN.learnerId, pin: PIN.pin } },
    { label: "a missing learnerId", fields: { parentId: PIN.parentId, pin: PIN.pin } },
    { label: "a missing pin", fields: { parentId: PIN.parentId, learnerId: PIN.learnerId } },
    { label: "a too-short (3-digit) pin", fields: { ...PIN, pin: "123" } },
    { label: "a too-long (7-digit) pin", fields: { ...PIN, pin: "1234567" } },
    { label: "a non-numeric pin", fields: { ...PIN, pin: "12ab" } },
    { label: "everything missing", fields: {} },
  ];

  for (const { label, fields } of BAD) {
    it(`rejects ${label} with error=missing_credentials before calling identity-svc`, async () => {
      await expect(learnerSignInAction(pinForm(fields))).rejects.toThrow(
        "NEXT_REDIRECT:/login?mode=learner&error=missing_credentials",
      );
      expect(identityPinLogin).not.toHaveBeenCalled();
    });
  }

  it("accepts a 6-digit pin and proceeds to the identity-svc call", async () => {
    toSessionProfile.mockReturnValueOnce(LEARNER_PROFILE);
    await expect(learnerSignInAction(pinForm({ ...PIN, pin: "123456" }))).rejects.toThrow(
      "NEXT_REDIRECT:/learner/home",
    );
    expect(identityPinLogin).toHaveBeenCalledTimes(1);
  });
});

describe("learnerSignInAction identity-svc PIN failure mapping (friendly error code)", () => {
  // A genuine wrong PIN — the auth provider rejected the credentials (401) or
  // couldn't find the parent/learner (403/404) — keeps the friendly "that PIN
  // didn't work" message (invalid_credentials). A service/network failure
  // (500 / 502 / unreachable) gets its own service_unavailable code so a child
  // isn't told their PIN is wrong when sign-in is merely down.
  const CASES = [
    { status: 401, code: "invalid_credentials" },
    { status: 403, code: "invalid_credentials" },
    { status: 404, code: "invalid_credentials" },
    { status: 500, code: "service_unavailable" },
    { status: 502, code: "service_unavailable" },
    { status: undefined, code: "service_unavailable" },
  ] as const;

  for (const { status, code } of CASES) {
    it(`redirects with error=${code} for status ${status ?? "(none)"}`, async () => {
      identityPinLogin.mockResolvedValueOnce({ kind: "error", status });
      await expect(learnerSignInAction(pinForm({ ...PIN }))).rejects.toThrow(
        `NEXT_REDIRECT:/login?mode=learner&error=${code}`,
      );
      expect(setAuthSessionCookies).not.toHaveBeenCalled();
    });
  }
});

describe("learnerSignInAction profile guard (unsupported_role)", () => {
  // The success path must reject any session whose profile is missing, whose
  // role isn't "learner", or whose learnerId doesn't match the submitted one
  // — otherwise a mismatched profile could be minted as a learner session.
  it("redirects with error=unsupported_role when the session profile is null", async () => {
    toSessionProfile.mockReturnValueOnce(null);
    await expect(learnerSignInAction(pinForm({ ...PIN }))).rejects.toThrow(
      "NEXT_REDIRECT:/login?mode=learner&error=unsupported_role",
    );
    expect(setAuthSessionCookies).not.toHaveBeenCalled();
  });

  it("redirects with error=unsupported_role when the resolved role isn't learner", async () => {
    toSessionProfile.mockReturnValueOnce({ ...LEARNER_PROFILE, role: "parent" });
    await expect(learnerSignInAction(pinForm({ ...PIN }))).rejects.toThrow(
      "NEXT_REDIRECT:/login?mode=learner&error=unsupported_role",
    );
    expect(setAuthSessionCookies).not.toHaveBeenCalled();
  });

  it("redirects with error=unsupported_role when the learnerId doesn't match the submitted one", async () => {
    toSessionProfile.mockReturnValueOnce({ ...LEARNER_PROFILE, learnerId: "someone_else" });
    await expect(learnerSignInAction(pinForm({ ...PIN }))).rejects.toThrow(
      "NEXT_REDIRECT:/login?mode=learner&error=unsupported_role",
    );
    expect(setAuthSessionCookies).not.toHaveBeenCalled();
  });
});

describe("learnerSignInAction successful PIN sign-in", () => {
  it("redirects to /learner/home and sets session cookies on success", async () => {
    toSessionProfile.mockReturnValueOnce(LEARNER_PROFILE);
    await expect(learnerSignInAction(pinForm({ ...PIN }))).rejects.toThrow(
      "NEXT_REDIRECT:/learner/home",
    );
    expect(setAuthSessionCookies).toHaveBeenCalledTimes(1);
    const [, payload] = setAuthSessionCookies.mock.calls[0];
    expect(payload).toEqual({
      accessToken: "access_tok",
      refreshToken: "refresh_tok",
      profile: LEARNER_PROFILE,
    });
  });
});
