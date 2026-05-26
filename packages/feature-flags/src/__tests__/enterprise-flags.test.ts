import { describe, expect, it } from "vitest";
import {
  ENTERPRISE_FLAG_ENV_VARS,
  readBooleanFromSource,
  resolveEnterpriseFlags,
} from "../enterprise-flags.js";

describe("readBooleanFromSource", () => {
  it.each(["1", "true", "yes", "on", "TRUE", "Yes", " On "])("parses %s as truthy", (value) => {
    expect(readBooleanFromSource({ FLAG: value }, "FLAG", false)).toBe(true);
  });

  it.each(["0", "false", "no", "off", "FALSE", "No"])("parses %s as falsy", (value) => {
    expect(readBooleanFromSource({ FLAG: value }, "FLAG", true)).toBe(false);
  });

  it("returns the default when the variable is missing", () => {
    expect(readBooleanFromSource({}, "FLAG", false)).toBe(false);
    expect(readBooleanFromSource({}, "FLAG", true)).toBe(true);
  });

  it("returns the default for unparseable values", () => {
    expect(readBooleanFromSource({ FLAG: "maybe" }, "FLAG", false)).toBe(false);
    expect(readBooleanFromSource({ FLAG: "maybe" }, "FLAG", true)).toBe(true);
  });

  it("treats empty string as falsy", () => {
    expect(readBooleanFromSource({ FLAG: "" }, "FLAG", true)).toBe(false);
  });
});

describe("resolveEnterpriseFlags", () => {
  it("defaults every enterprise flag to false when env is empty", () => {
    const flags = resolveEnterpriseFlags({});
    expect(flags).toEqual({
      problemSessionLedger: false,
      tutorSurfaceProtocol: false,
      profileRecommendationsV2: false,
      districtEnterpriseMode: false,
      sisSync: false,
      lti13: false,
      dataGovernanceCenter: false,
      responsibleAiGuardrails: false,
      advancedContentGenerators: false,
      selfRegulationHub: false,
      messaging: false,
    });
  });

  it("honors each enterprise env var independently", () => {
    const source: Record<string, string> = {};
    for (const envVar of Object.values(ENTERPRISE_FLAG_ENV_VARS)) {
      source[envVar] = "true";
    }
    const flags = resolveEnterpriseFlags(source);
    for (const value of Object.values(flags)) {
      expect(value).toBe(true);
    }
  });

  it("enables only the requested flag", () => {
    const flags = resolveEnterpriseFlags({
      [ENTERPRISE_FLAG_ENV_VARS.problemSessionLedger]: "1",
    });
    expect(flags.problemSessionLedger).toBe(true);
    expect(flags.tutorSurfaceProtocol).toBe(false);
    expect(flags.districtEnterpriseMode).toBe(false);
  });
});
