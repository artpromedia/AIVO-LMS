/**
 * Single-child auto-bounce — /learner/select/auto.
 *
 * A parent with exactly one learner never sees the profile grid: the
 * /learner/select page redirects them straight through this GET route handler,
 * which is the ONLY place (besides a Server Action) Next.js 15 lets us mutate
 * cookies. It must:
 *   - bounce unauthenticated callers to /login;
 *   - send non-parents to their own role home (no learner cookie);
 *   - reject a learnerId the parent doesn't own with ?error=forbidden and NO
 *     active-learner cookie (the same lock the picker enforces);
 *   - on the happy path, set the active-learner cookie and redirect to
 *     /learner/home.
 *
 * Guards + the authorization lookup are mocked so the test isolates the
 * route's routing + cookie contract.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const getSession = vi.fn();
vi.mock("@/lib/auth/session", () => ({
  getSession: () => getSession(),
}));

const redirectMock = vi.fn((url: string): never => {
  // Mirror next/navigation: redirect() halts execution by throwing.
  throw new Error(`NEXT_REDIRECT:${url}`);
});
vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}));

const verifyActiveLearner = vi.fn();
vi.mock("@/lib/auth/active-learner", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/active-learner")>();
  return { ...actual, verifyActiveLearner: (...a: unknown[]) => verifyActiveLearner(...a) };
});

import { GET } from "./route";
import { ACTIVE_LEARNER_COOKIE } from "@/lib/auth/active-learner";

const PARENT = { role: "parent", userId: "u_parent", tenantId: "t_demo" };

function req(learnerId?: string): Request {
  const base = "http://app.test/learner/select/auto";
  const url = learnerId === undefined ? base : `${base}?learnerId=${encodeURIComponent(learnerId)}`;
  // Provide a forwarded host so the route resolves a real public origin.
  return new Request(url, { headers: { host: "app.test" } });
}

describe("GET /learner/select/auto — single-child auto-bounce", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("unauthenticated → /login", async () => {
    getSession.mockResolvedValue(null);
    await expect(GET(req("lrn_ok"))).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(verifyActiveLearner).not.toHaveBeenCalled();
  });

  it("authorized single learner → sets the active-learner cookie, redirects to /learner/home", async () => {
    getSession.mockResolvedValue(PARENT);
    verifyActiveLearner.mockResolvedValue("lrn_ok");

    const res = await GET(req("lrn_ok"));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://app.test/learner/home");
    const cookie = res.cookies.get(ACTIVE_LEARNER_COOKIE);
    expect(cookie?.value).toBe("lrn_ok");
    expect(cookie?.httpOnly).toBe(true);
  });

  it("learnerId the parent does not own → ?error=forbidden, no learner cookie", async () => {
    getSession.mockResolvedValue(PARENT);
    verifyActiveLearner.mockResolvedValue(null);

    const res = await GET(req("lrn_not_mine"));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "http://app.test/learner/select?error=forbidden",
    );
    expect(res.cookies.get(ACTIVE_LEARNER_COOKIE)).toBeUndefined();
  });

  it("missing learnerId → ?error=forbidden without an authorization lookup", async () => {
    getSession.mockResolvedValue(PARENT);

    const res = await GET(req());

    expect(res.headers.get("location")).toBe(
      "http://app.test/learner/select?error=forbidden",
    );
    expect(verifyActiveLearner).not.toHaveBeenCalled();
    expect(res.cookies.get(ACTIVE_LEARNER_COOKIE)).toBeUndefined();
  });
});
