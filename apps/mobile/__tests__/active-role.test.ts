import { describe, it, expect, beforeEach } from "vitest";
import {
  ACTIVE_ROLE_HEADER,
  setApiActiveRole,
  getApiActiveRole,
  applyActiveRoleHeader,
} from "../lib/active-role";

beforeEach(() => {
  setApiActiveRole(null);
});

describe("active-role hint", () => {
  it("uses the canonical header name", () => {
    expect(ACTIVE_ROLE_HEADER).toBe("x-aivo-active-role");
  });

  it("is unset by default and after clearing", () => {
    expect(getApiActiveRole()).toBeNull();
    expect(applyActiveRoleHeader({})).toEqual({});
  });

  it("appends the header when a role is set", () => {
    setApiActiveRole("PARENT");
    expect(getApiActiveRole()).toBe("PARENT");
    expect(applyActiveRoleHeader({ Authorization: "Bearer x" })).toEqual({
      Authorization: "Bearer x",
      "x-aivo-active-role": "PARENT",
    });
  });

  it("treats empty/whitespace as unset", () => {
    setApiActiveRole("   ");
    expect(getApiActiveRole()).toBeNull();
    expect(applyActiveRoleHeader({})).toEqual({});
  });

  it("clears back to unset", () => {
    setApiActiveRole("teacher");
    setApiActiveRole(null);
    expect(applyActiveRoleHeader({})).toEqual({});
  });
});
