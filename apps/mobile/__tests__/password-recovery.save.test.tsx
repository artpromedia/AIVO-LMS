/**
 * Pinned contract: account recovery POSTs to identity-svc's
 * `/api/auth/forgot-password` with the normalized email and without an
 * auth header (the user is locked out). Backs both the auth
 * forgot-password screen and the documented web `onboarding/recovery`
 * parity mapping.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/constants/api", () => ({
  API: { IDENTITY: "https://identity.test" },
}));

const apiFetchMock = vi.fn();
vi.mock("@/lib/api", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

import { requestPasswordReset } from "../src/api/passwordRecovery";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("requestPasswordReset", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it("POSTs the normalized email to identity-svc, unauthenticated", async () => {
    apiFetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, message: "sent" }));

    const res = await requestPasswordReset("  Parent@Example.COM ");

    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    const [base, path, init] = apiFetchMock.mock.calls[0];
    expect(base).toBe("https://identity.test");
    expect(path).toBe("/api/auth/forgot-password");
    expect(init.method).toBe("POST");
    expect(init.skipAuth).toBe(true);
    expect(JSON.parse(init.body as string)).toEqual({ email: "parent@example.com" });
    expect(res).toMatchObject({ ok: true });
  });

  it("throws on a non-2xx response rather than reporting success", async () => {
    apiFetchMock.mockResolvedValueOnce(jsonResponse({ error: "rate limited" }, 429));
    await expect(requestPasswordReset("a@b.com")).rejects.toThrow("rate limited");
  });

  it("rethrows network failures", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("offline"));
    await expect(requestPasswordReset("a@b.com")).rejects.toThrow("offline");
  });
});
