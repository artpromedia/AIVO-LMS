import { describe, expect, it } from "vitest";
import {
  ROLES,
  ROLE_META,
  allRolesForSurface,
  canAccessArea,
  getRolesForSurface,
  hasActiveRole,
  holdsRole,
  isRoleSession,
  requiresStepUpForRole,
  type RoleSession,
} from "../index.js";

function makeSession(overrides: Partial<RoleSession> = {}): RoleSession {
  return {
    id: "u_test",
    tenantId: "t_test",
    roles: ["parent", "teacher"],
    activeRole: "parent",
    capabilities: [],
    ...overrides,
  };
}

describe("RoleSession contract", () => {
  it("validates well-formed sessions", () => {
    expect(isRoleSession(makeSession())).toBe(true);
  });

  it("rejects sessions whose activeRole is not in roles", () => {
    expect(
      isRoleSession({
        id: "u",
        tenantId: "t",
        roles: ["parent"],
        activeRole: "teacher",
        capabilities: [],
      }),
    ).toBe(false);
  });

  it("rejects sessions with unknown roles", () => {
    expect(
      isRoleSession({
        id: "u",
        tenantId: "t",
        roles: ["wizard"],
        activeRole: "wizard",
        capabilities: [],
      }),
    ).toBe(false);
  });

  it("rejects non-objects", () => {
    expect(isRoleSession(null)).toBe(false);
    expect(isRoleSession("nope")).toBe(false);
    expect(isRoleSession(undefined)).toBe(false);
  });

  it("hasActiveRole and holdsRole agree about the active role", () => {
    const s = makeSession({ activeRole: "parent" });
    expect(hasActiveRole(s, "parent")).toBe(true);
    expect(hasActiveRole(s, "teacher")).toBe(false);
    expect(holdsRole(s, "parent")).toBe(true);
    expect(holdsRole(s, "teacher")).toBe(true);
    expect(holdsRole(s, "learner")).toBe(false);
  });
});

describe("surface filtering", () => {
  it("getRolesForSurface drops mobile-only roles on web inputs only when ROLE_META disagrees", () => {
    // districtAdmin and internal are web-only per ROLE_META.
    const session = makeSession({
      roles: ["parent", "districtAdmin", "internal"],
      activeRole: "parent",
    });
    expect(getRolesForSurface(session.roles, "web")).toEqual([
      "parent",
      "districtAdmin",
      "internal",
    ]);
    expect(getRolesForSurface(session.roles, "mobile")).toEqual(["parent"]);
  });

  it("allRolesForSurface omits districtAdmin and internal on mobile", () => {
    const mobile = allRolesForSurface("mobile");
    expect(mobile).not.toContain("districtAdmin");
    expect(mobile).not.toContain("internal");
    for (const r of ["learner", "parent", "teacher", "therapist", "caregiver"] as const) {
      expect(mobile).toContain(r);
    }
  });

  it("allRolesForSurface on web mirrors ROLE_META.onWeb", () => {
    const web = allRolesForSurface("web");
    for (const r of ROLES) {
      expect(web.includes(r)).toBe(ROLE_META[r].onWeb);
    }
  });
});

describe("requiresStepUpForRole", () => {
  it("matches the ROLE_META declaration for every role", () => {
    for (const r of ROLES) {
      expect(requiresStepUpForRole(r)).toBe(ROLE_META[r].requiresStepUp);
    }
  });

  it("does not require step-up to switch into learner", () => {
    expect(requiresStepUpForRole("learner")).toBe(false);
  });

  it("requires step-up for parent/teacher/therapist/caregiver and all admins", () => {
    for (const r of [
      "parent",
      "teacher",
      "therapist",
      "caregiver",
      "schoolAdmin",
      "districtAdmin",
      "internal",
    ] as const) {
      expect(requiresStepUpForRole(r)).toBe(true);
    }
  });
});

describe("canAccessArea decisions", () => {
  it("allows the active role when the matrix grants full access", () => {
    const s = makeSession({ activeRole: "learner", roles: ["learner"] });
    const d = canAccessArea(s, "home", "web");
    expect(d.outcome).toBe("allow");
  });

  it("returns switch-role when active role hides the area but another held role grants it", () => {
    // A user signed in as `parent` who is also a `schoolAdmin` and
    // tries to view the `admin` area. Parent has admin=hidden;
    // schoolAdmin has admin=full.
    const s = makeSession({
      activeRole: "parent",
      roles: ["parent", "schoolAdmin"],
    });
    const d = canAccessArea(s, "admin", "web");
    expect(d.outcome).toBe("switch-role");
    expect(d.requiredRole).toBe("schoolAdmin");
  });

  it("returns locked when the active role is explicitly locked for the area", () => {
    // Parent's aiTutor entry is access=locked with a lockReason.
    const s = makeSession({ activeRole: "parent", roles: ["parent"] });
    const d = canAccessArea(s, "aiTutor", "web");
    expect(d.outcome).toBe("locked");
    expect(d.lockReason).toBeTruthy();
  });

  it("returns forbidden when no role the session holds can reach the area", () => {
    const s = makeSession({
      activeRole: "learner",
      roles: ["learner"],
    });
    // Learner cannot reach the district `admin` area.
    const d = canAccessArea(s, "admin", "web");
    expect(d.outcome).toBe("forbidden");
  });
});
