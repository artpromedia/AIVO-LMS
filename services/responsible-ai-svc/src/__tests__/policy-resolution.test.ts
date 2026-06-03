import { describe, expect, it, beforeEach } from "vitest";
import { createSeededStore, type RegistryStore } from "../registry/store.js";
import { resolveEffectivePolicy } from "../registry/policy-resolution.js";

let store: RegistryStore;
beforeEach(() => {
  store = createSeededStore();
});

describe("resolveEffectivePolicy — scope precedence (tenant > district > platform)", () => {
  it("stacks platform, district and tenant scopes", () => {
    const eff = resolveEffectivePolicy(store, {
      tenantId: "tenant-springfield",
      modelId: "model-tutor-pro",
    });
    expect(eff.appliedScopes.map((s) => s.level)).toEqual(["platform", "district", "tenant"]);
  });

  it("raises the age floor to the most specific (tenant) value", () => {
    // platform=5, district=6, tenant=7 → effective 7
    const eff = resolveEffectivePolicy(store, {
      tenantId: "tenant-springfield",
      modelId: "model-tutor-pro",
    });
    expect(eff.ageGating.minAge).toBe(7);
  });

  it("treats block-lists as additive across scopes (child can only tighten)", () => {
    const eff = resolveEffectivePolicy(store, {
      tenantId: "tenant-springfield",
      modelId: "model-tutor-pro",
    });
    // platform: violence/self-harm/sexual; district adds weapons
    expect(eff.contentSafety.blockedCategories).toEqual(
      expect.arrayContaining(["violence", "self-harm", "sexual", "weapons"]),
    );
  });

  it("falls back to platform when tenant has no district mapping", () => {
    const eff = resolveEffectivePolicy(store, {
      tenantId: "tenant-unknown",
      modelId: "model-tutor-pro",
    });
    expect(eff.appliedScopes.map((s) => s.level)).toEqual(["platform"]);
    expect(eff.allowed).toBe(true);
  });
});

describe("opt-out precedence", () => {
  it("tenant opt-out denies the model", () => {
    store.optOuts.set("o1", {
      id: "o1",
      tenantId: "tenant-springfield",
      modelId: "model-tutor-pro",
      feature: null,
      reason: "policy",
      createdBy: "district_admin",
      createdByRole: "district_admin",
      createdAt: new Date().toISOString(),
    });
    const eff = resolveEffectivePolicy(store, {
      tenantId: "tenant-springfield",
      modelId: "model-tutor-pro",
    });
    expect(eff.allowed).toBe(false);
    expect(eff.denyReason).toBe("OPT_OUT");
  });

  it("district opt-out cascades to child tenants", () => {
    store.optOuts.set("o2", {
      id: "o2",
      tenantId: "district-springfield",
      modelId: "model-tutor-pro",
      feature: null,
      reason: "district-wide",
      createdBy: "district_admin",
      createdByRole: "district_admin",
      createdAt: new Date().toISOString(),
    });
    // tenant-shelbyville belongs to district-springfield
    const eff = resolveEffectivePolicy(store, {
      tenantId: "tenant-shelbyville",
      modelId: "model-tutor-pro",
    });
    expect(eff.allowed).toBe(false);
    expect(eff.denyReason).toBe("OPT_OUT");
  });

  it("feature opt-out denies matching feature only", () => {
    store.optOuts.set("o3", {
      id: "o3",
      tenantId: "tenant-springfield",
      modelId: null,
      feature: "ai-tutor",
      reason: "",
      createdBy: "x",
      createdByRole: "district_admin",
      createdAt: new Date().toISOString(),
    });
    expect(
      resolveEffectivePolicy(store, {
        tenantId: "tenant-springfield",
        modelId: "model-tutor-pro",
        feature: "ai-tutor",
      }).allowed,
    ).toBe(false);
    expect(
      resolveEffectivePolicy(store, {
        tenantId: "tenant-springfield",
        modelId: "model-tutor-pro",
        feature: "speech-eval",
      }).allowed,
    ).toBe(true);
  });

  it("retired models are denied regardless of policy", () => {
    const m = store.models.get("model-math-vision")!;
    store.models.set(m.id, { ...m, status: "retired" });
    const eff = resolveEffectivePolicy(store, {
      tenantId: "tenant-springfield",
      modelId: "model-math-vision",
    });
    expect(eff.allowed).toBe(false);
    expect(eff.denyReason).toBe("MODEL_RETIRED");
  });
});

describe("performance — policy resolution < 5ms p95", () => {
  it("resolves well under budget", () => {
    const samples: number[] = [];
    for (let i = 0; i < 1000; i++) {
      const start = performance.now();
      resolveEffectivePolicy(store, { tenantId: "tenant-springfield", modelId: "model-tutor-pro" });
      samples.push(performance.now() - start);
    }
    samples.sort((a, b) => a - b);
    const p95 = samples[Math.floor(samples.length * 0.95)];
    expect(p95).toBeLessThan(5);
  });
});
