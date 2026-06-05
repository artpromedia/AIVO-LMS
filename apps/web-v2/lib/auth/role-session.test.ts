/**
 * Unit tests for the Phase 1 role-session builder + multi-role cookie
 * parsers.
 */
import { describe, expect, it } from "vitest";
import {
  buildRoleSession,
  parseActiveRoleCookie,
  parseSessionRolesCookie,
  toNavRole,
  toWebRole,
} from "./role-session";
import type { SessionProfile } from "./types";

const baseProfile: SessionProfile = {
  userId: "u_1",
  tenantId: "t_1",
  role: "teacher",
  email: "teacher@demo.aivo",
  displayName: "Ms. Vega",
  permissions: ["class:read", "class:write"],
};

describe("toNavRole / toWebRole", () => {
  it("round-trips every web role", () => {
    const webRoles: SessionProfile["role"][] = [
      "learner",
      "parent",
      "teacher",
      "caregiver",
      "therapist",
      "school_admin",
      "district_admin",
      "platform_admin",
      "support",
      "marketing",
      "sales",
      "devops",
      "engineering",
    ];
    for (const r of webRoles) {
      expect(toWebRole(toNavRole(r))).toBe(r);
    }
  });

  it("maps snake_case admins to camelCase nav ids", () => {
    expect(toNavRole("school_admin")).toBe("schoolAdmin");
    expect(toNavRole("district_admin")).toBe("districtAdmin");
    expect(toNavRole("platform_admin")).toBe("internal");
    expect(toNavRole("support")).toBe("internal");
  });
});

describe("parseSessionRolesCookie", () => {
  it("returns [] for empty / undefined", () => {
    expect(parseSessionRolesCookie(undefined)).toEqual([]);
    expect(parseSessionRolesCookie("")).toEqual([]);
  });

  it("parses, trims, dedupes, and drops unknown roles", () => {
    expect(parseSessionRolesCookie(" parent ,teacher,parent,bogus,learner")).toEqual([
      "parent",
      "teacher",
      "learner",
    ]);
  });
});

describe("parseActiveRoleCookie", () => {
  it("returns null for unknown / empty", () => {
    expect(parseActiveRoleCookie(undefined)).toBeNull();
    expect(parseActiveRoleCookie("")).toBeNull();
    expect(parseActiveRoleCookie("ceo")).toBeNull();
  });

  it("returns the role when known", () => {
    expect(parseActiveRoleCookie("teacher")).toBe("teacher");
    expect(parseActiveRoleCookie("school_admin")).toBe("school_admin");
  });
});

describe("buildRoleSession", () => {
  it("emits RoleSession shape with the active role first", () => {
    const payload = buildRoleSession({
      ...baseProfile,
      roles: ["teacher", "parent", "caregiver"],
    });
    expect(payload).toEqual({
      id: "u_1",
      tenantId: "t_1",
      roles: ["teacher", "parent", "caregiver"],
      activeRole: "teacher",
      capabilities: ["class:read", "class:write"],
    });
  });

  it("falls back to [role] when profile has no extra roles", () => {
    const payload = buildRoleSession(baseProfile);
    expect(payload.roles).toEqual(["teacher"]);
    expect(payload.activeRole).toBe("teacher");
  });

  it("recomputes capabilities from the active role", () => {
    const payload = buildRoleSession({
      ...baseProfile,
      role: "district_admin",
      permissions: ["stale:permission"],
      capabilities: ["stale:capability"],
    });
    expect(payload.capabilities).toContain("district:read");
    expect(payload.capabilities).not.toContain("stale:permission");
    expect(payload.capabilities).not.toContain("stale:capability");
  });

  it("dedupes the active role out of additional roles", () => {
    const payload = buildRoleSession({
      ...baseProfile,
      roles: ["teacher", "teacher", "parent"],
    });
    expect(payload.roles).toEqual(["teacher", "parent"]);
  });

  it("maps snake_case admins to nav camelCase ids", () => {
    const payload = buildRoleSession({
      ...baseProfile,
      role: "school_admin",
      roles: ["school_admin", "district_admin"],
    });
    expect(payload.activeRole).toBe("schoolAdmin");
    expect(payload.roles).toEqual(["schoolAdmin", "districtAdmin"]);
  });
});
