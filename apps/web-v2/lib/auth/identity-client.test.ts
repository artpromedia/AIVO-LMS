/**
 * Open-redirect proof for the PIN sign-in client (`identityPinLogin`).
 *
 * The email/password client (`identityLogin` / staff logins) deliberately
 * surfaces a `redirectTo` / `wrongSurface` from a 403 wrong-surface response
 * so the login server actions can forward the user to the correct portal —
 * those actions run that value through `isSafeSurfaceRedirect` before trusting
 * it. The PIN client is different: it has NO `redirectTo` / `wrongSurface`
 * fields and never forwards a server-supplied destination. These tests pin
 * that contract so a crafted identity-svc response can't smuggle an off-site
 * destination into ANY PIN consumer (the kid `/login` form's
 * `learnerSignInAction` and the parent hand-off `enterAsLearner`, which both
 * call this one client and only ever navigate to hardcoded in-app paths).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/env", () => ({
  serverEnv: { IDENTITY_SVC_URL: "https://identity.internal" },
}));

import { identityPinLogin } from "./identity-client";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("identityPinLogin off-site redirect rejection", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("drops an off-site redirectTo + wrongSurface from a 403 wrong-surface response", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(403, {
        error: "wrong surface",
        redirectTo: "https://evil.example/phish",
        wrongSurface: "https://evil.example",
      }),
    );

    const result = await identityPinLogin({ parentId: "p", learnerId: "l", pin: "1234" });

    expect(result.kind).toBe("error");
    if (result.kind !== "error") throw new Error("expected an error result");
    expect(result.status).toBe(403);
    // The crafted navigation target must NOT survive onto the result: the PIN
    // client has no redirectTo/wrongSurface fields, so a consumer literally
    // cannot read an off-site destination back out of it.
    expect(result).not.toHaveProperty("redirectTo");
    expect(result).not.toHaveProperty("wrongSurface");
    expect(JSON.stringify(result)).not.toContain("evil.example");
  });

  it("drops a protocol-relative redirectTo on a 401 (wrong PIN) response", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { error: "bad pin", redirectTo: "//evil.example" }));

    const result = await identityPinLogin({ parentId: "p", learnerId: "l", pin: "9999" });

    expect(result.kind).toBe("error");
    expect(JSON.stringify(result)).not.toContain("evil.example");
  });

  it("drops a redirectTo on a 429 (rate-limited) response", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(429, { error: "locked", redirectTo: "https://evil.example/portal" }),
    );

    const result = await identityPinLogin({ parentId: "p", learnerId: "l", pin: "1234" });

    expect(result.kind).toBe("error");
    if (result.kind === "error") expect(result.status).toBe(429);
    expect(JSON.stringify(result)).not.toContain("evil.example");
  });

  it("ignores a redirectTo even on a 200 success payload (no off-site leak)", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        user: { id: "l", role: "LEARNER", tenantId: "t" },
        accessToken: "access_tok",
        redirectTo: "https://evil.example/phish",
      }),
    );

    const result = await identityPinLogin({ parentId: "p", learnerId: "l", pin: "1234" });

    expect(result.kind).toBe("ok");
    expect(result).not.toHaveProperty("redirectTo");
    expect(JSON.stringify(result)).not.toContain("evil.example");
  });
});
