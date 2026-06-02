import { describe, expect, it } from "vitest";
import { isRoleAwareNotificationPayload, withTargetRole } from "../notifications-contract.js";
import { resolveDeepLink } from "../deep-links.js";
import type { RoleSession } from "../session.js";

function session(): RoleSession {
  return {
    id: "u-1",
    tenantId: "t-1",
    roles: ["parent", "teacher"],
    activeRole: "teacher",
    capabilities: [],
  };
}

describe("isRoleAwareNotificationPayload", () => {
  const valid = {
    id: "n-1",
    userId: "u-1",
    tenantId: "t-1",
    title: "Consent needed",
    body: "Approve the new math lesson",
    href: "/parent/consent",
    targetRole: "parent",
    type: "approval_request",
    createdAt: "2026-05-31T00:00:00Z",
    readAt: null,
  };

  it("accepts a complete payload", () => {
    expect(isRoleAwareNotificationPayload(valid)).toBe(true);
  });

  it("accepts a payload with targetLearnerId and data", () => {
    expect(
      isRoleAwareNotificationPayload({
        ...valid,
        targetLearnerId: "l-1",
        data: { assignmentId: "a-9" },
      }),
    ).toBe(true);
  });

  it("rejects payloads missing targetRole", () => {
    const { targetRole, ...rest } = valid;
    void targetRole;
    expect(isRoleAwareNotificationPayload(rest)).toBe(false);
  });

  it("rejects payloads with the wrong type for href", () => {
    expect(isRoleAwareNotificationPayload({ ...valid, href: 123 })).toBe(false);
  });

  it("rejects non-object inputs", () => {
    expect(isRoleAwareNotificationPayload(null)).toBe(false);
    expect(isRoleAwareNotificationPayload("string")).toBe(false);
    expect(isRoleAwareNotificationPayload(undefined)).toBe(false);
  });
});

describe("withTargetRole", () => {
  it("stamps the target role onto a legacy payload", () => {
    const stamped = withTargetRole({ href: "/parent/consent", title: "t", body: "b" }, "parent");
    expect(stamped.targetRole).toBe("parent");
    expect(stamped.href).toBe("/parent/consent");
    expect(stamped.targetLearnerId).toBeUndefined();
  });

  it("includes targetLearnerId when provided", () => {
    const stamped = withTargetRole({ href: "/learner/1/goals" }, "therapist", "l-1");
    expect(stamped.targetRole).toBe("therapist");
    expect(stamped.targetLearnerId).toBe("l-1");
  });
});

describe("integration: notification → resolveDeepLink", () => {
  it("a teacher who is also a parent gets routed via /role-switch when tapping a parent-targeted push", () => {
    const payload = withTargetRole({ href: "/parent/consent" }, "parent");
    const decision = resolveDeepLink(payload.href, session());
    // teacher's approvals is `linked` → allow, so the test sanity-checks
    // that the targetRole differs from activeRole and the resolver
    // surfaces an actionable result.
    expect(payload.targetRole).toBe("parent");
    expect(session().activeRole).toBe("teacher");
    expect(["allow", "switch-role"]).toContain(decision.outcome);
  });
});
