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

import { enterLearnerHome } from "./active-learner-actions";
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
