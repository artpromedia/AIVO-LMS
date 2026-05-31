/**
 * Unit tests for the Phase 1 step-up verifier (mock-mode branch).
 *
 * The real-mode branch defers to `@aivo/security`'s JWT verifier,
 * which has its own coverage in the security package; here we focus
 * on the mock-mode contract that gates dev role-switch flows.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  serverEnv: { AUTH_MODE: "mock" },
}));

import { buildMockStepUpToken, verifyRoleChangeStepUp } from "./step-up-verify";

describe("verifyRoleChangeStepUp (mock mode)", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("rejects when no token is presented", async () => {
    const r = await verifyRoleChangeStepUp({
      token: null,
      targetRole: "parent",
      userId: "u_1",
    });
    expect(r).toEqual({ ok: false, reason: "missing" });
  });

  it("rejects malformed tokens", async () => {
    for (const t of ["", "garbage", "mock-stepup.", "mock-stepup.parent", "mock-stepup..123"]) {
      const r = await verifyRoleChangeStepUp({
        token: t,
        targetRole: "parent",
        userId: "u_1",
      });
      expect(r.ok).toBe(false);
    }
  });

  it("rejects expired tokens", async () => {
    const past = Math.floor(Date.now() / 1000) - 10;
    const r = await verifyRoleChangeStepUp({
      token: `mock-stepup.parent.${past}`,
      targetRole: "parent",
      userId: "u_1",
    });
    expect(r).toEqual({ ok: false, reason: "expired" });
  });

  it("rejects tokens minted for a different role", async () => {
    const token = buildMockStepUpToken("parent");
    const r = await verifyRoleChangeStepUp({
      token,
      targetRole: "teacher",
      userId: "u_1",
    });
    expect(r).toEqual({ ok: false, reason: "wrong_scope" });
  });

  it("accepts a freshly minted token for the right role", async () => {
    const token = buildMockStepUpToken("teacher");
    const r = await verifyRoleChangeStepUp({
      token,
      targetRole: "teacher",
      userId: "u_1",
    });
    expect(r).toEqual({ ok: true });
  });

  it("handles admin role tokens via snake_case web id", async () => {
    const token = buildMockStepUpToken("schoolAdmin");
    expect(token).toMatch(/^mock-stepup\.school_admin\./);
    const r = await verifyRoleChangeStepUp({
      token,
      targetRole: "schoolAdmin",
      userId: "u_1",
    });
    expect(r).toEqual({ ok: true });
  });
});
