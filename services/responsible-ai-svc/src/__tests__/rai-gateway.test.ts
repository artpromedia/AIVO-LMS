import { describe, expect, it, vi } from "vitest";
import { createRaiGateway } from "../lib/rai-gateway.js";
import type { EffectivePolicy } from "../registry/types.js";

function policyResponse(partial: Partial<EffectivePolicy>): Response {
  const body: EffectivePolicy = {
    tenantId: "t",
    modelId: "m",
    allowed: true,
    denyReason: null,
    contentSafety: { blockedCategories: [], maxSeverity: "low" },
    ageGating: { minAge: null, requireGuardianConsent: false },
    regionRestrictions: { allowedRegions: [], blockedRegions: [] },
    appliedScopes: [],
    computedAt: new Date().toISOString(),
    ...partial,
  };
  return new Response(JSON.stringify(body), { status: 200 });
}

describe("RAI gateway", () => {
  it("allows when effective policy allows", async () => {
    const fetchImpl = vi.fn(async () => policyResponse({ allowed: true }));
    const gw = createRaiGateway({ fetchImpl: fetchImpl as unknown as typeof fetch });
    const d = await gw.check({ tenantId: "t", modelId: "m" });
    expect(d.allowed).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("short-circuits and fires onBlocked when denied", async () => {
    const onBlocked = vi.fn();
    const fetchImpl = vi.fn(async () => policyResponse({ allowed: false, denyReason: "OPT_OUT" }));
    const gw = createRaiGateway({ fetchImpl: fetchImpl as unknown as typeof fetch, onBlocked });
    const d = await gw.check({ tenantId: "t", modelId: "m" });
    expect(d.allowed).toBe(false);
    expect(d.reason).toBe("OPT_OUT");
    expect(onBlocked).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "OPT_OUT", tenantId: "t", modelId: "m" }),
    );
  });

  it("caches decisions for the TTL (no repeat network call)", async () => {
    const fetchImpl = vi.fn(async () => policyResponse({ allowed: true }));
    const gw = createRaiGateway({ fetchImpl: fetchImpl as unknown as typeof fetch, ttlMs: 60_000 });
    await gw.check({ tenantId: "t", modelId: "m" });
    const second = await gw.check({ tenantId: "t", modelId: "m" });
    expect(second.cached).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("fails open by default when the service is unreachable", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    });
    const gw = createRaiGateway({ fetchImpl: fetchImpl as unknown as typeof fetch });
    const d = await gw.check({ tenantId: "t", modelId: "m" });
    expect(d.allowed).toBe(true);
  });

  it("fails closed when configured", async () => {
    const onBlocked = vi.fn();
    const fetchImpl = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    });
    const gw = createRaiGateway({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      failClosed: true,
      onBlocked,
    });
    const d = await gw.check({ tenantId: "t", modelId: "m" });
    expect(d.allowed).toBe(false);
    expect(d.reason).toBe("RAI_UNAVAILABLE");
    expect(onBlocked).toHaveBeenCalled();
  });
});
