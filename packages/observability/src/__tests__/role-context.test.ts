import { describe, expect, it } from "vitest";
import {
  ANONYMOUS_ROLE,
  roleContextAttributes,
  roleContextBase,
  withRoleContext,
} from "../role-context.js";

const session = {
  id: "u-1",
  tenantId: "t-1",
  roles: ["teacher", "parent"],
  activeRole: "teacher",
};

describe("roleContextBase", () => {
  it("stamps activeRole, availableRoles, tenantId and userId", () => {
    const base = roleContextBase(session);
    expect(base.activeRole).toBe("teacher");
    expect(base.availableRoles).toEqual(["parent", "teacher"]); // sorted
    expect(base.tenantId).toBe("t-1");
    expect(base.userId).toBe("u-1");
  });

  it("falls back to anonymous when session is null/undefined", () => {
    expect(roleContextBase(null).activeRole).toBe(ANONYMOUS_ROLE);
    expect(roleContextBase(undefined).activeRole).toBe(ANONYMOUS_ROLE);
    expect(roleContextBase(null).availableRoles).toEqual([]);
  });

  it("omits tenantId / userId when not present on the session", () => {
    const base = roleContextBase({ activeRole: "parent" });
    expect(base.tenantId).toBeUndefined();
    expect(base.userId).toBeUndefined();
    expect(base.availableRoles).toEqual([]);
  });
});

describe("withRoleContext", () => {
  it("merges the role-context fields into a payload", () => {
    const merged = withRoleContext({ event: "lesson.start" }, session);
    expect(merged.event).toBe("lesson.start");
    expect(merged.activeRole).toBe("teacher");
    expect(merged.userId).toBe("u-1");
  });

  it("payload keys win on collision", () => {
    const merged = withRoleContext(
      { event: "lesson.start", activeRole: "parent" },
      session,
    );
    expect(merged.activeRole).toBe("parent");
  });

  it("strips sensitive keys via the shared redactor (no PII leaks)", () => {
    const merged = withRoleContext(
      { event: "lesson.start", apiKey: "sk_live_abcdefghijklmnop12345" },
      session,
    );
    expect(merged.apiKey).toBe("[redacted]");
  });

  it("stamps the anonymous sentinel when no session is supplied", () => {
    const merged = withRoleContext({ event: "auth.attempt" });
    expect(merged.activeRole).toBe(ANONYMOUS_ROLE);
    expect(merged.availableRoles).toEqual([]);
  });
});

describe("roleContextAttributes", () => {
  it("emits OTel-style flat string attributes", () => {
    expect(roleContextAttributes(session)).toEqual({
      "aivo.active_role": "teacher",
      "aivo.available_roles": "parent,teacher",
      "aivo.tenant_id": "t-1",
      "aivo.user_id": "u-1",
    });
  });

  it("falls back to anonymous on missing session", () => {
    expect(roleContextAttributes(null)).toEqual({
      "aivo.active_role": ANONYMOUS_ROLE,
      "aivo.available_roles": "",
    });
  });
});
