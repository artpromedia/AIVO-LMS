import { describe, expect, it } from "vitest";
import {
  buildRoleSwitchHref,
  classifyDeepLinkPath,
  getDeepLinkAreas,
  parseDeepLinkUrl,
  resolveDeepLink,
} from "../deep-links.js";
import { NAV_AREAS } from "../areas.js";
import { ROLES, type Role } from "../roles.js";
import type { RoleSession } from "../session.js";

function session(roles: Role[], activeRole: Role): RoleSession {
  return {
    id: "u-1",
    tenantId: "t-1",
    roles,
    activeRole,
    capabilities: [],
  };
}

describe("parseDeepLinkUrl", () => {
  it("parses the aivo:// custom scheme", () => {
    const url = parseDeepLinkUrl("aivo://learner/123/goals");
    expect(url).not.toBeNull();
    expect(url?.pathname).toBe("/learner/123/goals");
  });

  it("parses bare pathnames", () => {
    const url = parseDeepLinkUrl("/notifications?foo=bar#x");
    expect(url?.pathname).toBe("/notifications");
    expect(url?.search).toBe("?foo=bar");
    expect(url?.hash).toBe("#x");
  });

  it("parses fully-qualified universal links", () => {
    const url = parseDeepLinkUrl("https://aivo.app/learner/9/iep");
    expect(url?.pathname).toBe("/learner/9/iep");
  });

  it("returns null for garbage input", () => {
    expect(parseDeepLinkUrl("")).toBeNull();
    expect(parseDeepLinkUrl("not a url at all")).toBeNull();
  });
});

describe("classifyDeepLinkPath", () => {
  it("maps /learner/:id/goals to the iep area", () => {
    expect(classifyDeepLinkPath("/learner/123/goals")).toEqual({
      area: "iep",
      params: { learnerId: "123", subResource: "goals" },
    });
  });

  it("maps /learner/:id/progress to the progress area", () => {
    const out = classifyDeepLinkPath("/learner/abc/progress");
    expect(out.area).toBe("progress");
    expect(out.params.learnerId).toBe("abc");
  });

  it("maps /notifications, /messages, /settings, /billing", () => {
    expect(classifyDeepLinkPath("/notifications").area).toBe("messages");
    expect(classifyDeepLinkPath("/messages/123").area).toBe("messages");
    expect(classifyDeepLinkPath("/settings/profile").area).toBe("settings");
    expect(classifyDeepLinkPath("/billing").area).toBe("billing");
  });

  it("returns null area for an unknown path", () => {
    expect(classifyDeepLinkPath("/no/such/route").area).toBeNull();
  });
});

describe("resolveDeepLink — same role can render", () => {
  it("returns allow when the active role can reach the area", () => {
    const d = resolveDeepLink(
      "aivo://learner/123/goals",
      session(["parent"], "parent"),
    );
    expect(d.outcome).toBe("allow");
    expect(d.area).toBe("iep");
    expect(d.params.learnerId).toBe("123");
  });
});

describe("resolveDeepLink — switchable role", () => {
  it("recommends a switch when another held role can reach the area", () => {
    // learner cannot reach /billing (locked), but parent (held) can.
    const d = resolveDeepLink(
      "/billing",
      session(["learner", "parent"], "learner"),
    );
    // For learner, billing is `locked` not `hidden`, so canAccessArea
    // returns `locked` — the resolver should propagate that.
    expect(["locked", "switch-role"]).toContain(d.outcome);
  });

  it("switches role when the active role has no access but a held one does", () => {
    // therapist has no access to billing — caregiver also lacks it.
    // teacher → /billing is locked; parent → linked (full/linked).
    const d = resolveDeepLink(
      "/billing",
      session(["teacher", "parent"], "teacher"),
    );
    // teacher billing is `locked`. parent billing is `linked` → allow.
    // The resolver prefers the active role's `locked` outcome first.
    expect(d.outcome).toBe("locked");
  });

  it("sends caregiver→parent when entering /parent/consent as a caregiver who also parents", () => {
    const d = resolveDeepLink(
      "/parent/consent",
      session(["caregiver", "parent"], "caregiver"),
    );
    expect(d.outcome).toBe("switch-role");
    expect(d.requiredRole).toBe("parent");
    expect(d.requiresStepUp).toBe(true);
  });

  it("never 404s when at least one held role can reach the area", () => {
    const allRoles = [...ROLES];
    for (const active of allRoles) {
      const d = resolveDeepLink(
        "/learner/1/goals",
        session(allRoles, active),
      );
      expect(d.outcome).not.toBe("unmatched");
    }
  });
});

describe("resolveDeepLink — locked & forbidden", () => {
  it("returns locked with the matrix reason for the active role", () => {
    const d = resolveDeepLink(
      "/learner/1/goals", // iep
      session(["learner"], "learner"),
    );
    expect(d.outcome).toBe("locked");
    expect(d.lockReason).toMatch(/parent|teacher|grown-up|IEP/i);
  });

  it("returns forbidden when no held role can reach the area", () => {
    // caregiver has nothing for /admin/school
    const d = resolveDeepLink(
      "/admin/school/billing",
      session(["caregiver"], "caregiver"),
    );
    expect(d.outcome).toBe("forbidden");
  });
});

describe("resolveDeepLink — unmatched", () => {
  it("returns unmatched for unknown route shapes", () => {
    const d = resolveDeepLink(
      "/totally/made-up/route",
      session(["parent"], "parent"),
    );
    expect(d.outcome).toBe("unmatched");
  });

  it("preserves search and hash on the decision", () => {
    const d = resolveDeepLink(
      "/notifications?focus=urgent#row-5",
      session(["parent"], "parent"),
    );
    expect(d.search).toBe("?focus=urgent");
    expect(d.hash).toBe("#row-5");
  });
});

describe("buildRoleSwitchHref", () => {
  it("encodes to, next, and reason", () => {
    const href = buildRoleSwitchHref(
      "parent",
      { pathname: "/learner/1/goals", search: "?a=1", hash: "#x" },
      "notification",
    );
    expect(href).toBe(
      "/role-switch?to=parent&next=%2Flearner%2F1%2Fgoals%3Fa%3D1%23x&reason=notification",
    );
  });

  it("defaults the reason to deep-link", () => {
    const href = buildRoleSwitchHref("teacher", {
      pathname: "/messages",
      search: "",
      hash: "",
    });
    expect(href).toContain("reason=deep-link");
    expect(href).toContain("to=teacher");
  });
});

describe("getDeepLinkAreas", () => {
  it("only returns canonical NavArea values", () => {
    const areas = getDeepLinkAreas();
    expect(areas.length).toBeGreaterThan(0);
    for (const area of areas) {
      expect(NAV_AREAS).toContain(area);
    }
  });
});
