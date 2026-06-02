/**
 * Sprint 12 — baseline pipeline observability + feature-flag metadata.
 */
import { describe, expect, it, beforeEach } from "vitest";
import { ensureSeeded } from "@/lib/db/seed";
import { resetStore, getStore } from "@/lib/db/store";
import { getBaselinePipelineMetrics } from "@/lib/db/repos";
import { ENTERPRISE_FLAG_META, listFlagMeta, resolveEnterpriseFlags } from "@aivo/feature-flags";

describe("getBaselinePipelineMetrics", () => {
  beforeEach(() => {
    resetStore();
    ensureSeeded();
    // The seed lays down sample moderation events for the safety
    // dashboards; clear them so this aggregator's tests see ONLY the
    // rows we author below.
    getStore().moderationEvents.clear();
  });

  it("returns 0 metrics on an empty store", () => {
    const m = getBaselinePipelineMetrics();
    expect(m.totalEvaluatedItems).toBe(0);
    expect(m.blockRatePct).toBe(0);
    expect(m.fallbackShareOfShippedPct).toBe(0);
    expect(m.topViolations).toEqual([]);
  });

  it("aggregates moderation events into block / allow buckets", () => {
    const store = getStore();
    const now = new Date().toISOString();
    store.moderationEvents.set("a", {
      id: "a",
      tenantId: "t-1",
      learnerId: "lr-1",
      contextType: "baseline",
      severity: "high",
      violations: [{ code: "AGE_INAPPROPRIATE" }],
      recommendedAction: "block",
      shipped: "no",
      source: "ai",
      createdAt: now,
    } as never);
    store.moderationEvents.set("b", {
      id: "b",
      tenantId: "t-1",
      learnerId: "lr-1",
      contextType: "baseline",
      severity: "none",
      violations: [],
      recommendedAction: "allow",
      shipped: "yes",
      source: "fallback",
      createdAt: now,
    } as never);
    store.moderationEvents.set("c", {
      id: "c",
      tenantId: "t-1",
      learnerId: "lr-1",
      contextType: "baseline",
      severity: "none",
      violations: [],
      recommendedAction: "allow",
      shipped: "yes",
      source: "ai",
      createdAt: now,
    } as never);

    const m = getBaselinePipelineMetrics();
    expect(m.totalEvaluatedItems).toBe(3);
    expect(m.byRecommendedAction.block).toBe(1);
    expect(m.byRecommendedAction.allow).toBe(2);
    expect(m.blockRatePct).toBe(33);
    expect(m.fallbackShareOfShippedPct).toBe(50);
    expect(m.topViolations[0]?.code).toBe("AGE_INAPPROPRIATE");
  });

  it("respects an explicit time window", () => {
    const store = getStore();
    const oldIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    store.moderationEvents.set("old", {
      id: "old",
      tenantId: "t-1",
      learnerId: "lr-1",
      contextType: "baseline",
      severity: "high",
      violations: [],
      recommendedAction: "block",
      shipped: "no",
      source: "ai",
      createdAt: oldIso,
    } as never);
    const m = getBaselinePipelineMetrics({
      startIso: new Date(Date.now() - 60 * 1000).toISOString(),
      endIso: new Date().toISOString(),
    });
    expect(m.totalEvaluatedItems).toBe(0);
  });
});

describe("feature-flag metadata", () => {
  it("exposes one FlagMeta entry per resolved key", () => {
    const resolved = resolveEnterpriseFlags({});
    const meta = listFlagMeta();
    expect(meta.length).toBe(Object.keys(resolved).length);
    for (const m of meta) {
      expect(ENTERPRISE_FLAG_META[m.key]).toBeDefined();
      expect(typeof m.label).toBe("string");
      expect(typeof m.envVar).toBe("string");
      expect(["low", "medium", "high"]).toContain(m.riskBand);
    }
  });
});
