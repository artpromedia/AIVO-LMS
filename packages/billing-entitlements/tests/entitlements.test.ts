import { test } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateTutorEntitlement,
  computeEffectiveTutorSkus,
  isTutorIncludedInPlan,
  getTutorSkuForTutorKey,
  getTutorKeyForTutorSku,
  isPlanId,
  ALL_PLAN_IDS,
  TUTOR_KEY_TO_SKU,
  ALL_TUTOR_SKUS,
  ALL_TUTOR_KEYS,
} from "../src/index.js";

test("tutor key <-> sku round-trips for every tutor", () => {
  for (const key of ALL_TUTOR_KEYS) {
    const sku = getTutorSkuForTutorKey(key);
    assert.equal(getTutorKeyForTutorSku(sku), key);
  }
  assert.equal(ALL_TUTOR_SKUS.length, ALL_TUTOR_KEYS.length);
});

test("there are exactly two plans: family and enterprise", () => {
  assert.deepEqual([...ALL_PLAN_IDS].sort(), ["enterprise", "family"]);
  assert.ok(isPlanId("family"));
  assert.ok(isPlanId("enterprise"));
  assert.ok(!isPlanId("free"));
  assert.ok(!isPlanId("single"));
  assert.ok(!isPlanId("district"));
});

test("both tiers are all-access — every tutor is included", () => {
  for (const plan of ALL_PLAN_IDS) {
    for (const sku of ALL_TUTOR_SKUS) {
      assert.ok(isTutorIncludedInPlan(plan, sku), `${plan} should include ${sku}`);
    }
  }
});

test("inactive subscription denies entitlement to an included tutor", () => {
  const result = evaluateTutorEntitlement({
    subscription: { plan: "family", status: "canceled" },
    tutorSubscriptions: [],
    tutorSku: "ADDON_TUTOR_ELA",
  });
  assert.equal(result.entitled, false);
  assert.equal(result.reason, "subscription_inactive");
  assert.equal(result.upgradePath, "renew_subscription");
});

test("missing subscription denies entitlement", () => {
  const result = evaluateTutorEntitlement({
    subscription: null,
    tutorSubscriptions: [],
    tutorSku: "ADDON_TUTOR_ELA",
  });
  assert.equal(result.entitled, false);
  assert.equal(result.reason, "subscription_inactive");
});

test("active family plan grants any tutor (all-access)", () => {
  for (const sku of ALL_TUTOR_SKUS) {
    const result = evaluateTutorEntitlement({
      subscription: { plan: "family", status: "active" },
      tutorSubscriptions: [],
      tutorSku: sku,
    });
    assert.equal(result.entitled, true, `family should grant ${sku}`);
    assert.equal(result.reason, "included");
  }
});

test("active enterprise plan grants any tutor (all-access)", () => {
  for (const sku of ALL_TUTOR_SKUS) {
    const result = evaluateTutorEntitlement({
      subscription: { plan: "enterprise", status: "active" },
      tutorSubscriptions: [],
      tutorSku: sku,
    });
    assert.equal(result.entitled, true, `enterprise should grant ${sku}`);
    assert.equal(result.reason, "included");
  }
});

test("past_due subscription keeps access during retry window", () => {
  const result = evaluateTutorEntitlement({
    subscription: { plan: "family", status: "past_due" },
    tutorSubscriptions: [],
    tutorSku: "ADDON_TUTOR_ELA",
  });
  assert.equal(result.entitled, true);
});

test("trialing subscription grants access (card-on-file 30-day trial)", () => {
  const result = evaluateTutorEntitlement({
    subscription: { plan: "family", status: "trialing" },
    tutorSubscriptions: [],
    tutorSku: "ADDON_TUTOR_ELA",
  });
  assert.equal(result.entitled, true);
});

test("computeEffectiveTutorSkus returns every tutor for an active tier", () => {
  for (const plan of ALL_PLAN_IDS) {
    const skus = computeEffectiveTutorSkus({
      subscription: { plan, status: "active" },
      tutorSubscriptions: [],
    });
    assert.equal(skus.length, Object.keys(TUTOR_KEY_TO_SKU).length);
  }
});

test("computeEffectiveTutorSkus empty when subscription inactive", () => {
  const skus = computeEffectiveTutorSkus({
    subscription: { plan: "family", status: "canceled" },
    tutorSubscriptions: [],
  });
  assert.equal(skus.length, 0);
});

// ── lock-decision contract for tutor-card UI ────────────────────────────────
//
// The web/mobile tutor cards compute `effectiveTutorSkus` once and render a
// lock badge for any tutor key whose SKU isn't in that set. Under the
// two-tier all-access model an active subscriber sees zero locks; a
// canceled subscriber sees everything locked.

test("active family subscriber sees zero locked tutors", () => {
  const skus = new Set(
    computeEffectiveTutorSkus({
      subscription: { plan: "family", status: "active" },
      tutorSubscriptions: [],
    }),
  );
  for (const sku of ALL_TUTOR_SKUS) {
    assert.ok(skus.has(sku), `expected ${sku} unlocked`);
  }
});

test("canceled subscription locks every tutor", () => {
  const skus = new Set(
    computeEffectiveTutorSkus({
      subscription: { plan: "family", status: "canceled" },
      tutorSubscriptions: [],
    }),
  );
  assert.equal(skus.size, 0);
});

test("past_due subscription keeps tutors visible during Stripe retry", () => {
  const skus = new Set(
    computeEffectiveTutorSkus({
      subscription: { plan: "family", status: "past_due" },
      tutorSubscriptions: [],
    }),
  );
  assert.equal(skus.size, ALL_TUTOR_SKUS.length);
});

// ── configurable past_due grace policy ─────────────────────────────────────

test("past_due with default (allow) policy keeps tutor access", () => {
  const r = evaluateTutorEntitlement({
    subscription: { plan: "family", status: "past_due" },
    tutorSubscriptions: [],
    tutorSku: "ADDON_TUTOR_ELA",
  });
  assert.equal(r.entitled, true);
});

test("past_due with deny policy blocks tutor access", () => {
  const r = evaluateTutorEntitlement({
    subscription: { plan: "family", status: "past_due" },
    tutorSubscriptions: [],
    tutorSku: "ADDON_TUTOR_ELA",
    pastDueGracePolicy: "deny",
  });
  assert.equal(r.entitled, false);
  assert.equal(r.reason, "subscription_inactive");
});

test("past_due with deny policy empties the effective tutor set", () => {
  const skus = computeEffectiveTutorSkus({
    subscription: { plan: "family", status: "past_due" },
    tutorSubscriptions: [],
    pastDueGracePolicy: "deny",
  });
  assert.equal(skus.length, 0);
});

test("past_due with allow policy still respects active subscription requirement", () => {
  // canceled never gets a grace period, even under allow policy.
  const r = evaluateTutorEntitlement({
    subscription: { plan: "family", status: "canceled" },
    tutorSubscriptions: [],
    tutorSku: "ADDON_TUTOR_ELA",
    pastDueGracePolicy: "allow",
  });
  assert.equal(r.entitled, false);
});
