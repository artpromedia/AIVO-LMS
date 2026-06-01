import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ACTIVE_ROLE_HEADER,
  FORBIDDEN_ROLE_CODE,
  ACTIVE_ROLE_SPOOFING_EVENT,
  checkActiveRole,
} from "../src/active-role.js";

describe("constants", () => {
  it("expose the wire header + audit names", () => {
    assert.equal(ACTIVE_ROLE_HEADER, "x-aivo-active-role");
    assert.equal(FORBIDDEN_ROLE_CODE, "FORBIDDEN_ROLE");
    assert.equal(ACTIVE_ROLE_SPOOFING_EVENT, "auth.active_role.spoofing");
  });
});

describe("checkActiveRole", () => {
  it("is a no-op when the header is absent", () => {
    for (const v of [undefined, null, ""] as const) {
      const r = checkActiveRole("parent", v);
      assert.deepEqual(r, { ok: true, activeRole: null });
    }
  });

  it("passes when the header matches the single granted role", () => {
    const r = checkActiveRole("parent", "parent");
    assert.deepEqual(r, { ok: true, activeRole: "parent" });
  });

  it("is case/whitespace-insensitive", () => {
    const r = checkActiveRole("Teacher", "  TEACHER ");
    assert.equal(r.ok, true);
    assert.equal((r as { activeRole: string }).activeRole, "teacher");
  });

  it("rejects a role the token does not grant as a spoof", () => {
    const r = checkActiveRole("parent", "teacher");
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.code, FORBIDDEN_ROLE_CODE);
      assert.equal(r.requested, "teacher");
      assert.deepEqual(r.granted, ["parent"]);
    }
  });

  it("widens to availableRoles when supplied (multi-role tokens)", () => {
    const ok = checkActiveRole("parent", "teacher", {
      availableRoles: ["parent", "teacher"],
    });
    assert.equal(ok.ok, true);

    const bad = checkActiveRole("parent", "therapist", {
      availableRoles: ["parent", "teacher"],
    });
    assert.equal(bad.ok, false);
  });

  it("takes the first value when the header arrives as an array", () => {
    const r = checkActiveRole("parent", ["parent", "teacher"]);
    assert.equal(r.ok, true);
  });
});
