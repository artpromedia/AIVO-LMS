/**
 * Regression: the parent "Open today's mission" CTA must set the active-learner
 * cookie and land on /learner/home. It previously linked to the
 * /learner/select/auto GET route handler, whose client-side <Link> navigation
 * bounced the parent back to the dashboard. The Server Action below is the
 * reliable replacement — these tests pin its cookie + redirect contract.
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

const requirePageRole = vi.fn();
vi.mock("@/lib/auth/server", () => ({
  requirePageRole: (...args: unknown[]) => requirePageRole(...args),
}));

const verifyActiveLearner = vi.fn();
vi.mock("@/lib/auth/active-learner", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/active-learner")>();
  return { ...actual, verifyActiveLearner: (...a: unknown[]) => verifyActiveLearner(...a) };
});

// `enterAsLearner` dynamically imports these on the PIN-gated path; mock the
// identity round-trip + the session-cookie writer so the test isolates the
// action's routing + session-swap contract (no network, no real cookies).
const identityPinLogin = vi.fn();
const extractRefreshToken = vi.fn((..._a: unknown[]) => "refresh_tok");
const toSessionProfile = vi.fn();
vi.mock("@/lib/auth/identity-client", () => ({
  identityPinLogin: (...a: unknown[]) => identityPinLogin(...a),
  extractRefreshToken: (...a: unknown[]) => extractRefreshToken(...a),
  toSessionProfile: (...a: unknown[]) => toSessionProfile(...a),
}));

const setAuthSessionCookies = vi.fn();
vi.mock("@/lib/auth/session-cookies", () => ({
  setAuthSessionCookies: (...a: unknown[]) => setAuthSessionCookies(...a),
}));

import { enterLearnerHome, enterAsLearner } from "./active-learner-actions";
import { ACTIVE_LEARNER_COOKIE } from "@/lib/auth/active-learner";

const SESSION = { role: "parent", userId: "u_parent", tenantId: "t_demo" };

function formWith(learnerId?: string): FormData {
  const f = new FormData();
  if (learnerId !== undefined) f.set("learnerId", learnerId);
  return f;
}

describe("enterLearnerHome (parent → learner experience)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requirePageRole.mockResolvedValue(SESSION);
  });

  it("requires the parent role", async () => {
    verifyActiveLearner.mockResolvedValue("lrn_ok");
    await expect(enterLearnerHome(formWith("lrn_ok"))).rejects.toThrow(/NEXT_REDIRECT/);
    expect(requirePageRole).toHaveBeenCalledWith(["parent"]);
  });

  it("authorized learner → sets the active-learner cookie then redirects to /learner/home", async () => {
    verifyActiveLearner.mockResolvedValue("lrn_ok");
    await expect(enterLearnerHome(formWith("lrn_ok"))).rejects.toThrow(
      "NEXT_REDIRECT:/learner/home",
    );
    expect(cookieSet).toHaveBeenCalledTimes(1);
    expect(cookieSet.mock.calls[0][0]).toMatchObject({
      name: ACTIVE_LEARNER_COOKIE,
      value: "lrn_ok",
      httpOnly: true,
      path: "/",
    });
  });

  it("unauthorized learner → forbidden redirect, cookie never set", async () => {
    verifyActiveLearner.mockResolvedValue(null);
    await expect(enterLearnerHome(formWith("lrn_not_mine"))).rejects.toThrow(
      "NEXT_REDIRECT:/learner/select?error=forbidden",
    );
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it("missing learnerId → forbidden without an authorization lookup", async () => {
    await expect(enterLearnerHome(formWith())).rejects.toThrow(
      "NEXT_REDIRECT:/learner/select?error=forbidden",
    );
    expect(verifyActiveLearner).not.toHaveBeenCalled();
    expect(cookieSet).not.toHaveBeenCalled();
  });
});

/**
 * `enterAsLearner` is the PIN-gated session hand-off behind the
 * /learner/select profile picker: a parent picks a child and enters that
 * child's 4-6 digit PIN to truly sign in AS the learner (a session SWAP,
 * not the parent "view-as"). These tests pin the lock that keeps a child
 * out of the wrong profile and out of parent-only areas — the error paths
 * (wrong PIN, rate-limited 429, never-set 404, forbidden learner) must NEVER
 * swap the session, and the happy path must replace it deterministically.
 *
 * "Swapping the session" = calling `setAuthSessionCookies` (writes the new
 * learner's auth cookies). Asserting it is NOT called is the strongest proof
 * the lock held.
 */
function pinFormWith(opts: { learnerId?: string; pin?: string; returnTo?: string }): FormData {
  const f = new FormData();
  if (opts.learnerId !== undefined) f.set("learnerId", opts.learnerId);
  if (opts.pin !== undefined) f.set("pin", opts.pin);
  // The kid-facing picker stamps returnTo=/learner/select so errors stay on
  // the picker. Default it here so the suite exercises that surface.
  f.set("returnTo", opts.returnTo ?? "/learner/select");
  return f;
}

const LEARNER_PROFILE = {
  role: "learner",
  learnerId: "lrn_ok",
  userId: "lrn_ok",
  tenantId: "t_demo",
};

describe("enterAsLearner (PIN-gated session hand-off)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requirePageRole.mockResolvedValue(SESSION);
    extractRefreshToken.mockReturnValue("refresh_tok");
  });

  it("correct PIN → verifies via identity-svc, swaps the session, lands on /learner/home", async () => {
    verifyActiveLearner.mockResolvedValue("lrn_ok");
    identityPinLogin.mockResolvedValue({
      kind: "ok",
      user: { id: "lrn_ok", role: "LEARNER" },
      accessToken: "access_tok",
      setCookies: ["refreshToken=raw"],
    });
    toSessionProfile.mockReturnValue(LEARNER_PROFILE);

    await expect(
      enterAsLearner(pinFormWith({ learnerId: "lrn_ok", pin: "1234" })),
    ).rejects.toThrow("NEXT_REDIRECT:/learner/home");

    // The PIN is verified for the authorized learner under the parent session.
    expect(identityPinLogin).toHaveBeenCalledWith({
      parentId: "u_parent",
      learnerId: "lrn_ok",
      pin: "1234",
    });
    // Session SWAP happened with the learner's tokens + profile.
    expect(setAuthSessionCookies).toHaveBeenCalledTimes(1);
    expect(setAuthSessionCookies.mock.calls[0][1]).toMatchObject({
      accessToken: "access_tok",
      refreshToken: "refresh_tok",
      profile: LEARNER_PROFILE,
    });
    // The stale parent active-learner cookie is cleared (maxAge 0).
    expect(cookieSet).toHaveBeenCalledWith(
      expect.objectContaining({ name: ACTIVE_LEARNER_COOKIE, value: "", maxAge: 0 }),
    );
  });

  it("invalid PIN format → stays on /learner/select with error=invalid, no session swap", async () => {
    verifyActiveLearner.mockResolvedValue("lrn_ok");

    await expect(
      enterAsLearner(pinFormWith({ learnerId: "lrn_ok", pin: "12" })),
    ).rejects.toThrow("NEXT_REDIRECT:/learner/select?error=invalid");

    // Never even reached identity-svc, and the session is untouched.
    expect(identityPinLogin).not.toHaveBeenCalled();
    expect(setAuthSessionCookies).not.toHaveBeenCalled();
  });

  it("wrong PIN (identity 401) → stays on /learner/select with error=invalid, no session swap", async () => {
    verifyActiveLearner.mockResolvedValue("lrn_ok");
    identityPinLogin.mockResolvedValue({ kind: "error", status: 401, error: "bad pin" });

    await expect(
      enterAsLearner(pinFormWith({ learnerId: "lrn_ok", pin: "9999" })),
    ).rejects.toThrow("NEXT_REDIRECT:/learner/select?error=invalid");

    expect(setAuthSessionCookies).not.toHaveBeenCalled();
  });

  it("rate-limited (identity 429) → stays on /learner/select with error=locked, no session swap", async () => {
    verifyActiveLearner.mockResolvedValue("lrn_ok");
    identityPinLogin.mockResolvedValue({ kind: "error", status: 429, error: "locked" });

    await expect(
      enterAsLearner(pinFormWith({ learnerId: "lrn_ok", pin: "1234" })),
    ).rejects.toThrow("NEXT_REDIRECT:/learner/select?error=locked");

    expect(setAuthSessionCookies).not.toHaveBeenCalled();
  });

  it("errors from the parent hand-off surface stay on the hand-off page (returnTo defaults), no swap", async () => {
    verifyActiveLearner.mockResolvedValue("lrn_ok");
    identityPinLogin.mockResolvedValue({ kind: "error", status: 401, error: "bad pin" });

    // The parent hand-off form does NOT send returnTo=/learner/select, so the
    // action defaults to the per-learner hand-off page for its error bounce.
    await expect(
      enterAsLearner(pinFormWith({ learnerId: "lrn_ok", pin: "9999", returnTo: "" })),
    ).rejects.toThrow("NEXT_REDIRECT:/parent/learners/lrn_ok/enter?error=invalid");

    expect(setAuthSessionCookies).not.toHaveBeenCalled();
  });

  it("a forged returnTo is ignored (no open redirect) → falls back to the hand-off page", async () => {
    verifyActiveLearner.mockResolvedValue("lrn_ok");
    identityPinLogin.mockResolvedValue({ kind: "error", status: 401, error: "bad pin" });

    await expect(
      enterAsLearner(
        pinFormWith({ learnerId: "lrn_ok", pin: "9999", returnTo: "https://evil.test/phish" }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT:/parent/learners/lrn_ok/enter?error=invalid");

    expect(setAuthSessionCookies).not.toHaveBeenCalled();
  });

  it("no PIN set yet (identity 404) → routes to the set-PIN step, no session swap", async () => {
    verifyActiveLearner.mockResolvedValue("lrn_ok");
    identityPinLogin.mockResolvedValue({ kind: "error", status: 404, error: "no pin" });

    await expect(
      enterAsLearner(pinFormWith({ learnerId: "lrn_ok", pin: "1234" })),
    ).rejects.toThrow("NEXT_REDIRECT:/onboarding/pin?learnerId=lrn_ok");

    expect(setAuthSessionCookies).not.toHaveBeenCalled();
  });

  it("forbidden / not-owned learnerId → forbidden redirect, never touches the PIN or session", async () => {
    verifyActiveLearner.mockResolvedValue(null);

    await expect(
      enterAsLearner(pinFormWith({ learnerId: "lrn_not_mine", pin: "1234" })),
    ).rejects.toThrow("NEXT_REDIRECT:/learner/select?error=forbidden");

    expect(identityPinLogin).not.toHaveBeenCalled();
    expect(setAuthSessionCookies).not.toHaveBeenCalled();
  });

  it("identity returns a non-learner profile → treated as invalid, no session swap", async () => {
    verifyActiveLearner.mockResolvedValue("lrn_ok");
    identityPinLogin.mockResolvedValue({
      kind: "ok",
      user: { id: "lrn_ok", role: "PARENT" },
      accessToken: "access_tok",
      setCookies: [],
    });
    // A profile whose role/learnerId doesn't match the authorized learner.
    toSessionProfile.mockReturnValue({ ...LEARNER_PROFILE, role: "parent" });

    await expect(
      enterAsLearner(pinFormWith({ learnerId: "lrn_ok", pin: "1234" })),
    ).rejects.toThrow("NEXT_REDIRECT:/learner/select?error=invalid");

    expect(setAuthSessionCookies).not.toHaveBeenCalled();
  });
});

/**
 * Open-redirect guard for the PIN sign-in path — the third auth entry point
 * (alongside email/password sign-in and signup, which already have parity
 * coverage). `enterAsLearner` is the only PIN consumer that does its OWN
 * post-login navigation off a form-supplied destination (`returnTo`), so it
 * is the one place a crafted value could try to bounce the user off-site.
 *
 * Two invariants are pinned here:
 *   1. The post-login (success) navigation is hardcoded to the learner role
 *      home and must IGNORE any `returnTo` — a hostile destination cannot
 *      hijack a *successful* PIN login.
 *   2. The error bounce only honors `returnTo` through an exact-match
 *      allowlist (the kid picker); every off-site / protocol-relative /
 *      non-path value falls back to the in-app per-learner hand-off page,
 *      never an attacker-controlled host. No session is swapped on error.
 */
describe("enterAsLearner PIN open-redirect guard (returnTo can't go off-site)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requirePageRole.mockResolvedValue(SESSION);
    extractRefreshToken.mockReturnValue("refresh_tok");
  });

  const HOSTILE_RETURN_TO = [
    { label: "an off-site absolute URL", value: "https://evil.example/phish" },
    { label: "a protocol-relative URL", value: "//evil.example" },
    { label: "a javascript: scheme", value: "javascript:alert(1)" },
    { label: "a bare host (no leading slash)", value: "evil.example/path" },
    { label: "a backslash-prefixed path", value: "\\evil.example" },
    { label: "a non-allowlisted in-app path", value: "/parent/dashboard" },
  ];

  for (const { label, value } of HOSTILE_RETURN_TO) {
    it(`ignores ${label} on the error bounce → safe in-app hand-off page, no swap`, async () => {
      verifyActiveLearner.mockResolvedValue("lrn_ok");
      identityPinLogin.mockResolvedValue({ kind: "error", status: 401, error: "bad pin" });

      await expect(
        enterAsLearner(pinFormWith({ learnerId: "lrn_ok", pin: "9999", returnTo: value })),
      ).rejects.toThrow("NEXT_REDIRECT:/parent/learners/lrn_ok/enter?error=invalid");

      expect(setAuthSessionCookies).not.toHaveBeenCalled();
    });
  }

  it("a successful PIN login IGNORES a hostile returnTo and lands on the role home", async () => {
    verifyActiveLearner.mockResolvedValue("lrn_ok");
    identityPinLogin.mockResolvedValue({
      kind: "ok",
      user: { id: "lrn_ok", role: "LEARNER" },
      accessToken: "access_tok",
      setCookies: ["refreshToken=raw"],
    });
    toSessionProfile.mockReturnValue(LEARNER_PROFILE);

    // Even with an off-site returnTo on the form, the post-login redirect is
    // the hardcoded learner role home (ROLE_HOME.learner === "/learner/home").
    await expect(
      enterAsLearner(
        pinFormWith({ learnerId: "lrn_ok", pin: "1234", returnTo: "https://evil.example/phish" }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT:/learner/home");

    expect(setAuthSessionCookies).toHaveBeenCalledTimes(1);
  });

  it("a 403 wrong-surface error stays in-app (off-site returnTo ignored), no swap", async () => {
    verifyActiveLearner.mockResolvedValue("lrn_ok");
    // identity-svc could return a 403 with an off-site redirectTo, but the PIN
    // client never surfaces it (see identity-client.test.ts) and a 403 is not
    // specially routed — so the bounce stays on the safe in-app hand-off page.
    identityPinLogin.mockResolvedValue({ kind: "error", status: 403, error: "wrong surface" });

    await expect(
      enterAsLearner(
        pinFormWith({ learnerId: "lrn_ok", pin: "9999", returnTo: "https://evil.example/portal" }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT:/parent/learners/lrn_ok/enter?error=invalid");

    expect(setAuthSessionCookies).not.toHaveBeenCalled();
  });
});
