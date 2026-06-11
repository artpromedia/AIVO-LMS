import { describe, expect, it, vi } from "vitest";
import {
  createTenantFlagResolver,
  isValidFlagKey,
  killSwitchEnvVar,
} from "../tenant-flags";

const BASE_ENV = { AIVO_FEATURE_SELF_REGULATION_HUB: "false" };

describe("createTenantFlagResolver (Sprint B2)", () => {
  it("applies precedence: kill > tenant override > env default", async () => {
    const resolver = createTenantFlagResolver({
      env: {
        ...BASE_ENV,
        AIVO_FEATURE_SIS_SYNC: "true",
        [killSwitchEnvVar("sisSync")]: "1",
      },
      loadOverrides: async () => ({ selfRegulationHub: true, lti13: true }),
    });
    const flags = await resolver.resolveForTenant("t1");
    expect(flags.selfRegulationHub).toBe(true); // override beats env default(false)
    expect(flags.lti13).toBe(true);
    expect(flags.sisSync).toBe(false); // kill beats env ON
  });

  it("kill switch also defeats an ON tenant override", async () => {
    const resolver = createTenantFlagResolver({
      env: { [killSwitchEnvVar("selfRegulationHub")]: "true" },
      loadOverrides: async () => ({ selfRegulationHub: true }),
    });
    expect((await resolver.resolveForTenant("t1")).selfRegulationHub).toBe(false);
  });

  it("caches per tenant within the TTL and re-loads after invalidate", async () => {
    const loadOverrides = vi.fn(async () => ({ lti13: true }));
    let clock = 0;
    const resolver = createTenantFlagResolver({
      env: {},
      loadOverrides,
      cacheTtlMs: 1_000,
      now: () => clock,
    });
    await resolver.resolveForTenant("t1");
    await resolver.resolveForTenant("t1");
    expect(loadOverrides).toHaveBeenCalledTimes(1);
    clock = 2_000; // TTL expired
    await resolver.resolveForTenant("t1");
    expect(loadOverrides).toHaveBeenCalledTimes(2);
    resolver.invalidate("t1");
    await resolver.resolveForTenant("t1");
    expect(loadOverrides).toHaveBeenCalledTimes(3);
  });

  it("isolates tenants and serves env defaults for anonymous (no tenant)", async () => {
    const resolver = createTenantFlagResolver({
      env: {},
      loadOverrides: async (tenantId) =>
        tenantId === "a" ? { selfRegulationHub: true } : null,
    });
    expect((await resolver.resolveForTenant("a")).selfRegulationHub).toBe(true);
    expect((await resolver.resolveForTenant("b")).selfRegulationHub).toBe(false);
    expect((await resolver.resolveForTenant(null)).selfRegulationHub).toBe(false);
  });

  it("degrades to env defaults when the override loader throws", async () => {
    const resolver = createTenantFlagResolver({
      env: { AIVO_FEATURE_LTI_13: "true" },
      loadOverrides: async () => {
        throw new Error("settings store down");
      },
    });
    const flags = await resolver.resolveForTenant("t1");
    expect(flags.lti13).toBe(true);
  });

  it("validates flag keys for override writers", () => {
    expect(isValidFlagKey("selfRegulationHub")).toBe(true);
    expect(isValidFlagKey("notARealFlag")).toBe(false);
  });
});
