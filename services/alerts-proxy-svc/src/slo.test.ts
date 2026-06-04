import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeErrorBudget,
  burnRate,
  timeToExhaustionHours,
  shouldPageOnBurn,
} from "./slo/slo-math.js";
import { AlertDeduper, fingerprintOf, severityFromAlert, tenantFromAlert } from "./slo/dedupe.js";

describe("error budget math", () => {
  it("computes the budget for a 99.9% target", () => {
    const r = computeErrorBudget({ target: 0.999, goodEvents: 999_000, badEvents: 1_000 });
    assert.equal(r.totalEvents, 1_000_000);
    assert.equal(r.errorBudget, 1_000); // (1 - 0.999) * 1,000,000
    assert.equal(r.consumed, 1_000);
    assert.equal(r.remaining, 0);
    assert.equal(r.consumedFraction, 1);
    assert.equal(r.observedSli, 0.999);
  });

  it("goes negative when the budget is exhausted", () => {
    const r = computeErrorBudget({ target: 0.99, goodEvents: 98_000, badEvents: 2_000 });
    assert.equal(r.errorBudget, 1_000);
    assert.equal(r.remaining, -1_000);
    assert.ok(r.consumedFraction > 1);
  });

  it("treats zero traffic as fully healthy", () => {
    const r = computeErrorBudget({ target: 0.999, goodEvents: 0, badEvents: 0 });
    assert.equal(r.observedSli, 1);
    assert.equal(r.consumedFraction, 0);
  });
});

describe("burn rate", () => {
  it("is 1 when error rate equals the allowed rate", () => {
    // target 0.999 → allowed 0.001; badRate 0.001 → burn 1
    assert.equal(burnRate(0.999, 0.001), 1);
  });
  it("is 2x when burning twice as fast", () => {
    assert.equal(burnRate(0.999, 0.002), 2);
  });
  it("computes time to exhaustion", () => {
    // 30d window, burn 2 → exhausted in 360h (half the 720h window)
    assert.equal(timeToExhaustionHours(30, 2), 360);
    assert.equal(timeToExhaustionHours(30, 0), Infinity);
  });
  it("pages only when both windows exceed threshold", () => {
    assert.equal(shouldPageOnBurn({ fastWindowBurn: 5, slowWindowBurn: 5, threshold: 2 }), true);
    assert.equal(shouldPageOnBurn({ fastWindowBurn: 5, slowWindowBurn: 1, threshold: 2 }), false);
  });
});

describe("alert dedupe", () => {
  const firing = (extra: Record<string, string> = {}) => ({
    status: "firing" as const,
    labels: { alertname: "HighLatency", severity: "critical", ...extra },
  });

  it("accepts the first occurrence and suppresses duplicates in window", () => {
    const d = new AlertDeduper(60_000);
    assert.equal(d.accept(firing(), 0), true);
    assert.equal(d.accept(firing(), 1_000), false);
    assert.equal(d.accept(firing(), 30_000), false);
  });

  it("accepts again after the window elapses", () => {
    const d = new AlertDeduper(60_000);
    assert.equal(d.accept(firing(), 0), true);
    assert.equal(d.accept(firing(), 61_000), true);
  });

  it("always actions a firing→resolved transition", () => {
    const d = new AlertDeduper(60_000);
    assert.equal(d.accept(firing(), 0), true);
    assert.equal(
      d.accept(
        { status: "resolved", labels: { alertname: "HighLatency", severity: "critical" } },
        1_000,
      ),
      true,
    );
  });

  it("distinguishes alerts by labels", () => {
    const d = new AlertDeduper(60_000);
    assert.equal(d.accept(firing({ tenant_id: "a" }), 0), true);
    assert.equal(d.accept(firing({ tenant_id: "b" }), 0), true); // different fingerprint
  });

  it("derives a stable fingerprint, severity and tenant", () => {
    const a = firing({ tenant_id: "t1" });
    assert.equal(fingerprintOf(a), fingerprintOf(firing({ tenant_id: "t1" })));
    assert.equal(severityFromAlert(a), "critical");
    assert.equal(tenantFromAlert(a), "t1");
  });
});
