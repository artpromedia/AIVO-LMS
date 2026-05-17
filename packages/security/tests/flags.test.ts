import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  loadAdminEnterpriseFlags,
  logAdminEnterpriseFlags,
  parseBoolFlag,
  parseIntFlag,
} from "../src/flags.js";

describe("parseBoolFlag", () => {
  it("returns the default when undefined or empty", () => {
    assert.equal(parseBoolFlag(undefined, false), false);
    assert.equal(parseBoolFlag(undefined, true), true);
    assert.equal(parseBoolFlag("", false), false);
    assert.equal(parseBoolFlag("   ", true), true);
  });

  it("parses truthy values", () => {
    for (const v of ["1", "true", "TRUE", "yes", "on", "Enabled"]) {
      assert.equal(parseBoolFlag(v, false), true, `expected ${v} to be true`);
    }
  });

  it("parses falsy values", () => {
    for (const v of ["0", "false", "FALSE", "no", "off", "disabled"]) {
      assert.equal(parseBoolFlag(v, true), false, `expected ${v} to be false`);
    }
  });

  it("falls back to default for unrecognized input", () => {
    assert.equal(parseBoolFlag("maybe", false), false);
    assert.equal(parseBoolFlag("maybe", true), true);
  });
});

describe("parseIntFlag", () => {
  it("returns the default when undefined or empty", () => {
    assert.equal(parseIntFlag(undefined, 42), 42);
    assert.equal(parseIntFlag("", 42), 42);
    assert.equal(parseIntFlag("   ", 42), 42);
  });

  it("parses non-negative integers", () => {
    assert.equal(parseIntFlag("0", 5), 0);
    assert.equal(parseIntFlag("900", 0), 900);
  });

  it("rejects negative or non-numeric input", () => {
    assert.equal(parseIntFlag("-1", 30), 30);
    assert.equal(parseIntFlag("abc", 30), 30);
    assert.equal(parseIntFlag("NaN", 30), 30);
  });

  it("rejects partial-numeric and decimal input strictly", () => {
    assert.equal(parseIntFlag("900abc", 30), 30);
    assert.equal(parseIntFlag("1.5", 30), 30);
    assert.equal(parseIntFlag("1e3", 30), 30);
    assert.equal(parseIntFlag(" 900 ", 30), 900);
  });
});

describe("loadAdminEnterpriseFlags", () => {
  it("defaults every flag to OFF when env is empty", () => {
    const flags = loadAdminEnterpriseFlags({});
    assert.deepEqual(flags, {
      STRONG_MFA: false,
      STEP_UP_AUTH: false,
      DISTRICT_SSO: false,
      AUDIT_IMMUTABLE: false,
      ADMIN_SESSION_IDLE: 0,
    });
  });

  it("parses each flag from env", () => {
    const flags = loadAdminEnterpriseFlags({
      ADMIN_ENTERPRISE_STRONG_MFA: "true",
      ADMIN_ENTERPRISE_STEP_UP_AUTH: "1",
      ADMIN_ENTERPRISE_DISTRICT_SSO: "yes",
      ADMIN_ENTERPRISE_AUDIT_IMMUTABLE: "on",
      ADMIN_ENTERPRISE_ADMIN_SESSION_IDLE: "900",
    });
    assert.deepEqual(flags, {
      STRONG_MFA: true,
      STEP_UP_AUTH: true,
      DISTRICT_SSO: true,
      AUDIT_IMMUTABLE: true,
      ADMIN_SESSION_IDLE: 900,
    });
  });

  it("ignores garbage values and keeps defaults", () => {
    const flags = loadAdminEnterpriseFlags({
      ADMIN_ENTERPRISE_STRONG_MFA: "perhaps",
      ADMIN_ENTERPRISE_ADMIN_SESSION_IDLE: "soon",
    });
    assert.equal(flags.STRONG_MFA, false);
    assert.equal(flags.ADMIN_SESSION_IDLE, 0);
  });
});

describe("logAdminEnterpriseFlags", () => {
  it("emits one structured log line containing every flag", () => {
    const calls: Array<{ obj: Record<string, unknown>; msg?: string }> = [];
    const logger = {
      info: ((
        a: string | Record<string, unknown>,
        b?: string | Record<string, unknown>,
      ) => {
        if (typeof a === "string") {
          calls.push({ obj: (b as Record<string, unknown>) ?? {}, msg: a });
        } else {
          calls.push({ obj: a, msg: b as string | undefined });
        }
      }) as {
        (message: string, data?: Record<string, unknown>): void;
        (data: Record<string, unknown>, message?: string): void;
      },
    };
    const flags = loadAdminEnterpriseFlags({});
    logAdminEnterpriseFlags(logger, flags);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].msg, "admin enterprise feature flags");
    assert.deepEqual(calls[0].obj.adminEnterpriseFlags, flags);
  });
});
