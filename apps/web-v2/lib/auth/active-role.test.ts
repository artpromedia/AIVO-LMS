/**
 * Unit tests for `decideActiveRoleSwitch` — the pure logic behind
 * `POST /api/bff/me/active-role`.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  serverEnv: { AUTH_MODE: "mock" },
}));

import { buildMockStepUpToken } from "./step-up-verify";
import { decideActiveRoleSwitch } from "./active-role";
import type { SessionProfile } from "./types";

const multiRoleProfile: SessionProfile = {
  userId: "u_multi",
  tenantId: "t_demo",
  role: "teacher",
  email: "multi@demo.aivo",
  displayName: "Multi User",
  permissions: ["class:read"],
  roles: ["teacher", "parent", "learner"],
};

function headersFrom(record: Record<string, string>) {
  return (name: string) => record[name.toLowerCase()] ?? null;
}

describe("decideActiveRoleSwitch", () => {
  it("400s when body is missing or role is unknown", async () => {
    const a = await decideActiveRoleSwitch({
      session: multiRoleProfile,
      body: null,
      getHeader: headersFrom({}),
    });
    expect(a.ok).toBe(false);
    expect(a.ok === false && a.code).toBe("VALIDATION_FAILED");

    const b = await decideActiveRoleSwitch({
      session: multiRoleProfile,
      body: { role: "ceo" },
      getHeader: headersFrom({}),
    });
    expect(b.ok === false && b.code).toBe("VALIDATION_FAILED");
  });

  it("403 FORBIDDEN_ROLE when target is not in session.roles", async () => {
    const r = await decideActiveRoleSwitch({
      session: multiRoleProfile,
      body: { role: "internal" },
      getHeader: headersFrom({}),
    });
    expect(r.ok === false && r.code).toBe("FORBIDDEN_ROLE");
  });

  it("requires step-up when ROLE_META[target].requiresStepUp", async () => {
    const r = await decideActiveRoleSwitch({
      session: multiRoleProfile,
      body: { role: "parent" },
      getHeader: headersFrom({}),
    });
    expect(r.ok === false && r.code).toBe("STEP_UP_REQUIRED");
    expect(r.ok === false && r.stepUp?.scope).toBe("role:change");
  });

  it("rejects wrong-target step-up tokens", async () => {
    const token = buildMockStepUpToken("teacher");
    const r = await decideActiveRoleSwitch({
      session: multiRoleProfile,
      body: { role: "parent" },
      getHeader: headersFrom({ "x-step-up-token": token }),
    });
    expect(r.ok === false && r.code).toBe("STEP_UP_REQUIRED");
  });

  it("allows non-step-up switches (learner) and mints surface + active cookies", async () => {
    const r = await decideActiveRoleSwitch({
      session: multiRoleProfile,
      body: { role: "learner" },
      getHeader: headersFrom({}),
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.payload.activeRole).toBe("learner");
    expect(r.cookies.map((c) => c.name).sort()).toEqual(["aivo_active_role", "aivo_session_role"]);
    const active = r.cookies.find((c) => c.name === "aivo_active_role")!;
    expect(active.value).toBe("learner");
    expect(active.httpOnly).toBe(true);
    const surface = r.cookies.find((c) => c.name === "aivo_session_role")!;
    // Surface cookie format: <role>.<exp>.<sig>
    expect(surface.value.split(".")).toHaveLength(3);
    expect(surface.value.startsWith("learner.")).toBe(true);
  });

  it("allows step-up switches when a valid token is presented", async () => {
    const token = buildMockStepUpToken("parent");
    const r = await decideActiveRoleSwitch({
      session: multiRoleProfile,
      body: { role: "parent" },
      getHeader: headersFrom({ "x-step-up-token": token }),
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.payload.activeRole).toBe("parent");
    expect(r.payload.roles).toContain("parent");
  });

  it("is idempotent (no-op switch still 200, only writes active-role cookie)", async () => {
    const r = await decideActiveRoleSwitch({
      session: multiRoleProfile,
      body: { role: "teacher" },
      // step-up token required for teacher; build one
      getHeader: headersFrom({ "x-step-up-token": buildMockStepUpToken("teacher") }),
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.cookies.map((c) => c.name)).toEqual(["aivo_active_role"]);
  });
});
