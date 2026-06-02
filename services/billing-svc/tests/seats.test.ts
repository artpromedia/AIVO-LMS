/**
 * Seat-pooling domain unit tests. Pure functions, no DB or Stripe — the
 * fast feedback loop for the allocation invariants, future-dating rules,
 * MRR/ARR math, overage, and the concurrency guarantee (Sprint 4 DoD).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyAllocation,
  applyConcurrent,
  maxAllocatableTo,
  sumAllocated,
  unallocated,
  classifyEffectiveAt,
  isEffective,
  materialize,
  computeOverage,
  computeMrrCents,
  computeArrCents,
  churnRate,
  monthlyCents,
  type AllocationState,
  type SeatAllocation,
} from "../src/domain/seats.js";

function state(poolTotal: number, perSchool: Record<string, number> = {}): AllocationState {
  return { poolTotal, perSchool };
}

// ── allocation invariants ────────────────────────────────────────────────────

test("pool→school grant within the remainder succeeds", () => {
  const s = state(100, { a: 40 });
  const res = applyAllocation(s, { from: null, to: "b", count: 30 });
  assert.equal(res.ok, true);
  assert.equal(res.state.perSchool.b, 30);
  assert.equal(sumAllocated(res.state), 70);
});

test("pool→school grant exceeding the remainder is rejected", () => {
  const s = state(100, { a: 80 });
  const res = applyAllocation(s, { from: null, to: "b", count: 30 });
  assert.equal(res.ok, false);
  assert.equal(res.reason, "exceeds_pool_total");
  assert.deepEqual(res.state, s); // unchanged
});

test("school→school transfer conserves the pool sum", () => {
  const s = state(100, { a: 60, b: 10 });
  const res = applyAllocation(s, { from: "a", to: "b", count: 50 });
  assert.equal(res.ok, true);
  assert.equal(res.state.perSchool.a, 10);
  assert.equal(res.state.perSchool.b, 60);
  assert.equal(sumAllocated(res.state), sumAllocated(s));
});

test("transfer more than the source holds is rejected", () => {
  const s = state(100, { a: 60, b: 10 });
  const res = applyAllocation(s, { from: "a", to: "b", count: 61 });
  assert.equal(res.ok, false);
  assert.equal(res.reason, "insufficient_source");
});

test("non-positive and non-integer counts are rejected", () => {
  const s = state(100, { a: 10 });
  assert.equal(applyAllocation(s, { from: null, to: "b", count: 0 }).reason, "non_positive_count");
  assert.equal(applyAllocation(s, { from: null, to: "b", count: -5 }).reason, "non_positive_count");
  assert.equal(
    applyAllocation(s, { from: null, to: "b", count: 2.5 }).reason,
    "non_positive_count",
  );
});

test("transfer to the same school is rejected", () => {
  const s = state(100, { a: 10 });
  assert.equal(
    applyAllocation(s, { from: "a", to: "a", count: 1 }).reason,
    "same_source_and_target",
  );
});

test("maxAllocatableTo equals pool.total minus other allocations", () => {
  const s = state(100, { a: 40, b: 25 });
  assert.equal(maxAllocatableTo(s, "b"), 60); // 100 - 40 (only other is a)
  assert.equal(maxAllocatableTo(s, "c"), 35); // 100 - 65 (a and b)
  assert.equal(unallocated(s), 35);
});

// ── concurrency: only valid moves succeed, total never exceeds pool ──────────

test("ten parallel grants on the same pool never exceed pool.total", () => {
  const initial = state(100);
  // Ten schools each asking for 15 seats: only 6 fit (6*15=90), the
  // 7th onward must be rejected for exceeding the remainder.
  const moves = Array.from({ length: 10 }, (_, i) => ({
    from: null as string | null,
    to: `school-${i}`,
    count: 15,
  }));
  const out = applyConcurrent(initial, moves);
  assert.equal(out.applied.length, 6);
  assert.equal(out.rejected.length, 4);
  assert.ok(sumAllocated(out.state) <= initial.poolTotal);
  assert.equal(sumAllocated(out.state), 90);
  for (const r of out.rejected) assert.equal(r.reason, "exceeds_pool_total");
});

test("concurrent transfers conserve the pool sum exactly", () => {
  const initial = state(50, { a: 50, b: 0 });
  const moves = Array.from({ length: 10 }, () => ({
    from: "a" as string | null,
    to: "b",
    count: 6,
  }));
  const out = applyConcurrent(initial, moves);
  // a starts at 50; eight moves of 6 drain it to 2, the 9th/10th (need 6)
  // are rejected for insufficient source.
  assert.equal(out.applied.length, 8);
  assert.equal(sumAllocated(out.state), 50);
  assert.equal(out.state.perSchool.a, 2);
  assert.equal(out.state.perSchool.b, 48);
});

// ── future-dated effective dates ─────────────────────────────────────────────

test("classifyEffectiveAt distinguishes immediate, future, and invalid", () => {
  const now = new Date("2026-06-02T00:00:00Z");
  assert.equal(classifyEffectiveAt("2026-06-01T00:00:00Z", now), "immediate");
  assert.equal(classifyEffectiveAt("2026-06-02T00:00:00Z", now), "immediate");
  assert.equal(classifyEffectiveAt("2026-07-01T00:00:00Z", now), "future");
  assert.equal(classifyEffectiveAt("not-a-date", now), "invalid");
});

test("materialize applies only effective allocations in chronological order", () => {
  const now = new Date("2026-06-02T00:00:00Z");
  const allocations: SeatAllocation[] = [
    { from_tenant_id: null, to_tenant_id: "a", count: 30, effective_at: "2026-05-01T00:00:00Z" },
    { from_tenant_id: "a", to_tenant_id: "b", count: 10, effective_at: "2026-05-15T00:00:00Z" },
    // future-dated: must NOT be folded in yet
    { from_tenant_id: null, to_tenant_id: "c", count: 20, effective_at: "2026-07-01T00:00:00Z" },
  ];
  const s = materialize(100, allocations, now);
  assert.equal(s.perSchool.a, 20);
  assert.equal(s.perSchool.b, 10);
  assert.equal(s.perSchool.c ?? 0, 0); // future-dated not yet effective
  assert.equal(sumAllocated(s), 30);
});

test("isEffective is inclusive of the exact effective instant", () => {
  const now = new Date("2026-06-02T12:00:00Z");
  assert.equal(isEffective("2026-06-02T12:00:00Z", now), true);
  assert.equal(isEffective("2026-06-02T12:00:01Z", now), false);
});

// ── overage + hard-cap ───────────────────────────────────────────────────────

test("overage reports the gap but is not blocking without a hard-cap", () => {
  const o = computeOverage({ tenantId: "a", allocated: 50, used: 63 });
  assert.equal(o.isOver, true);
  assert.equal(o.overage, 13);
  assert.equal(o.hardCap, null);
  assert.equal(o.hardCapReached, false);
});

test("no overage when usage is at or below allocation", () => {
  const o = computeOverage({ tenantId: "a", allocated: 50, used: 50 });
  assert.equal(o.isOver, false);
  assert.equal(o.overage, 0);
});

test("hard-cap is reached when usage hits the configured ceiling", () => {
  const o = computeOverage({ tenantId: "a", allocated: 50, used: 60, hardCap: 60 });
  assert.equal(o.hardCapReached, true);
  assert.equal(
    computeOverage({ tenantId: "a", allocated: 50, used: 59, hardCap: 60 }).hardCapReached,
    false,
  );
});

// ── MRR / ARR / churn ────────────────────────────────────────────────────────

test("MRR normalizes annual lines and excludes non-recognized statuses", () => {
  const mrr = computeMrrCents([
    { amountCents: 2499, interval: "month", quantity: 10, status: "active" }, // 24990
    { amountCents: 120000, interval: "year", quantity: 1, status: "active" }, // 10000/mo
    { amountCents: 5000, interval: "month", quantity: 1, status: "trialing" }, // excluded
    { amountCents: 9999, interval: "month", quantity: 1, status: "canceled" }, // excluded
    { amountCents: 1999, interval: "month", quantity: 2, status: "past_due" }, // 3998
  ]);
  assert.equal(mrr, 24990 + 10000 + 3998);
});

test("ARR is exactly MRR times twelve", () => {
  const lines = [{ amountCents: 1000, interval: "month" as const, status: "active" }];
  assert.equal(computeArrCents(lines), computeMrrCents(lines) * 12);
  assert.equal(computeArrCents(lines), 12000);
});

test("monthlyCents divides annual by twelve and multiplies by quantity", () => {
  assert.equal(monthlyCents({ amountCents: 1200, interval: "year", status: "active" }), 100);
  assert.equal(
    monthlyCents({ amountCents: 1000, interval: "month", quantity: 3, status: "active" }),
    3000,
  );
});

test("churnRate guards against a zero starting base", () => {
  assert.equal(churnRate(0, 500), 0);
  assert.equal(churnRate(10000, 1500), 0.15);
});

// ── utilization aggregation core ─────────────────────────────────────────────
import { aggregatePool } from "../src/jobs/utilization.js";

test("aggregatePool promotes matured allocations and rolls up usage", () => {
  const now = new Date("2026-06-02T00:00:00Z");
  const out = aggregatePool({
    poolTotal: 100,
    hardCap: null,
    allocations: [
      {
        id: "1",
        fromTenantId: null,
        toTenantId: "a",
        count: 40,
        effectiveAt: "2026-05-01T00:00:00Z",
        status: "effective",
      },
      // matured but still flagged pending → should be promoted + counted
      {
        id: "2",
        fromTenantId: null,
        toTenantId: "b",
        count: 30,
        effectiveAt: "2026-06-01T00:00:00Z",
        status: "pending",
      },
      // future-dated → neither promoted nor counted
      {
        id: "3",
        fromTenantId: null,
        toTenantId: "c",
        count: 20,
        effectiveAt: "2026-07-01T00:00:00Z",
        status: "pending",
      },
    ],
    activeUsers: { a: 35, b: 33 },
    now,
  });
  assert.equal(out.allocated, 70); // a:40 + b:30
  assert.equal(out.used, 68); // 35 + 33
  assert.deepEqual(out.promote, ["2"]);
});

test("aggregatePool reports per-child overage and hard-cap breaches", () => {
  const now = new Date("2026-06-02T00:00:00Z");
  const out = aggregatePool({
    poolTotal: 100,
    hardCap: 50,
    allocations: [
      {
        id: "1",
        fromTenantId: null,
        toTenantId: "a",
        count: 40,
        effectiveAt: "2026-05-01T00:00:00Z",
        status: "effective",
      },
    ],
    activeUsers: { a: 52 }, // over its 40 allocation AND past the 50 hard-cap
    now,
  });
  assert.equal(out.overages.length, 1);
  assert.equal(out.overages[0].tenantId, "a");
  assert.equal(out.overages[0].overage, 12);
  assert.equal(out.overages[0].hardCapReached, true);
});
