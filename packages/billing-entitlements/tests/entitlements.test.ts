import { test } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateTutorEntitlement,
  computeEffectiveTutorSkus,
  isTutorIncludedInPlan,
  getTutorSkuForTutorKey,
  getTutorKeyForTutorSku,
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

test("free plan includes ELA only", () => {
  assert.ok(isTutorIncludedInPlan("free", "ADDON_TUTOR_ELA"));
  assert.ok(!isTutorIncludedInPlan("free", "ADDON_TUTOR_MATH"));
});

test("single and family include ELA + Math + Science + History", () => {
  for (const plan of ["single", "family"] as const) {
    assert.ok(isTutorIncludedInPlan(plan, "ADDON_TUTOR_ELA"));
    assert.ok(isTutorIncludedInPlan(plan, "ADDON_TUTOR_MATH"));
    assert.ok(isTutorIncludedInPlan(plan, "ADDON_TUTOR_SCIENCE"));
    assert.ok(isTutorIncludedInPlan(plan, "ADDON_TUTOR_HISTORY"));
    assert.ok(!isTutorIncludedInPlan(plan, "ADDON_TUTOR_CODING"));
  }
});

test("district includes every tutor", () => {
  for (const sku of ALL_TUTOR_SKUS) {
    assert.ok(isTutorIncludedInPlan("district", sku), `district should include ${sku}`);
  }
});

test("inactive subscription denies entitlement to included tutor", () => {
  const result = evaluateTutorEntitlement({
    subscription: { plan: "single", status: "canceled" },
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

test("active plan grants included tutor", () => {
  const result = evaluateTutorEntitlement({
    subscription: { plan: "single", status: "active" },
    tutorSubscriptions: [],
    tutorSku: "ADDON_TUTOR_MATH",
  });
  assert.equal(result.entitled, true);
  assert.equal(result.reason, "included");
});

test("active plan denies tutor not in plan without add-on", () => {
  const result = evaluateTutorEntitlement({
    subscription: { plan: "single", status: "active" },
    tutorSubscriptions: [],
    tutorSku: "ADDON_TUTOR_CODING",
  });
  assert.equal(result.entitled, false);
  assert.equal(result.reason, "not_entitled");
  assert.equal(result.upgradePath, "purchase_addon");
});

test("active add-on grants non-included tutor", () => {
  const result = evaluateTutorEntitlement({
    subscription: { plan: "single", status: "active" },
    tutorSubscriptions: [{ tutorSku: "ADDON_TUTOR_CODING", status: "active" }],
    tutorSku: "ADDON_TUTOR_CODING",
  });
  assert.equal(result.entitled, true);
  assert.equal(result.reason, "purchased");
});

test("grace-period add-on still grants access", () => {
  const result = evaluateTutorEntitlement({
    subscription: { plan: "single", status: "active" },
    tutorSubscriptions: [{ tutorSku: "ADDON_TUTOR_CODING", status: "grace_period" }],
    tutorSku: "ADDON_TUTOR_CODING",
  });
  assert.equal(result.entitled, true);
  assert.equal(result.reason, "grace_period");
});

test("canceled add-on does not grant access", () => {
  const result = evaluateTutorEntitlement({
    subscription: { plan: "single", status: "active" },
    tutorSubscriptions: [{ tutorSku: "ADDON_TUTOR_CODING", status: "canceled" }],
    tutorSku: "ADDON_TUTOR_CODING",
  });
  assert.equal(result.entitled, false);
});

test("past_due subscription keeps access during retry window", () => {
  const result = evaluateTutorEntitlement({
    subscription: { plan: "single", status: "past_due" },
    tutorSubscriptions: [],
    tutorSku: "ADDON_TUTOR_ELA",
  });
  assert.equal(result.entitled, true);
});

test("trialing subscription grants access", () => {
  const result = evaluateTutorEntitlement({
    subscription: { plan: "single", status: "trialing" },
    tutorSubscriptions: [],
    tutorSku: "ADDON_TUTOR_ELA",
  });
  assert.equal(result.entitled, true);
});

test("computeEffectiveTutorSkus merges included + active add-ons", () => {
  const skus = computeEffectiveTutorSkus({
    subscription: { plan: "single", status: "active" },
    tutorSubscriptions: [
      { tutorSku: "ADDON_TUTOR_CODING", status: "active" },
      { tutorSku: "ADDON_TUTOR_ARTS", status: "grace_period" },
      { tutorSku: "ADDON_TUTOR_LANGUAGES", status: "canceled" },
    ],
  });
  // 4 included + 2 active/grace add-ons = 6, canceled excluded
  assert.equal(skus.length, 6);
  assert.ok(skus.includes("ADDON_TUTOR_CODING"));
  assert.ok(skus.includes("ADDON_TUTOR_ARTS"));
  assert.ok(!skus.includes("ADDON_TUTOR_LANGUAGES"));
});

test("computeEffectiveTutorSkus empty when subscription inactive", () => {
  const skus = computeEffectiveTutorSkus({
    subscription: { plan: "single", status: "canceled" },
    tutorSubscriptions: [{ tutorSku: "ADDON_TUTOR_CODING", status: "active" }],
  });
  assert.equal(skus.length, 0);
});

test("district plan effective set includes every tutor", () => {
  const skus = computeEffectiveTutorSkus({
    subscription: { plan: "district", status: "active" },
    tutorSubscriptions: [],
  });
  assert.equal(skus.length, Object.keys(TUTOR_KEY_TO_SKU).length);
});

// ── Sprint 4: lock-decision contract for tutor-card UI ──────────────────────
//
// These tests pin down the exact set of (plan, addon) combinations the
// web/mobile tutor cards check via `Set<TutorSku>.has(sku)`. The UI
// computes `effectiveTutorSkus` once and renders a lock badge for any
// tutor key whose SKU isn't in that set. If these break, the lock UI
// will silently mis-render.

test("free plan locks every non-ELA tutor on the catalog", () => {
  const skus = new Set(
    computeEffectiveTutorSkus({
      subscription: { plan: "free", status: "active" },
      tutorSubscriptions: [],
    }),
  );
  assert.ok(skus.has("ADDON_TUTOR_ELA"));
  assert.ok(!skus.has("ADDON_TUTOR_MATH"));
  assert.ok(!skus.has("ADDON_TUTOR_CODING"));
  assert.ok(!skus.has("ADDON_TUTOR_ARTS"));
});

test("family plan with a purchased Coding add-on unlocks exactly 5 tutors", () => {
  const skus = new Set(
    computeEffectiveTutorSkus({
      subscription: { plan: "family", status: "active" },
      tutorSubscriptions: [{ tutorSku: "ADDON_TUTOR_CODING", status: "active" }],
    }),
  );
  assert.equal(skus.size, 5);
  for (const sku of [
    "ADDON_TUTOR_ELA",
    "ADDON_TUTOR_MATH",
    "ADDON_TUTOR_SCIENCE",
    "ADDON_TUTOR_HISTORY",
    "ADDON_TUTOR_CODING",
  ] as const) {
    assert.ok(skus.has(sku), `expected ${sku} unlocked`);
  }
});

test("canceled subscription locks even previously-included tutors", () => {
  // A learner whose parent canceled the family plan should immediately
  // see every paid tutor locked on the next refresh — past_due is the
  // grace window, canceled is the gate.
  const skus = new Set(
    computeEffectiveTutorSkus({
      subscription: { plan: "family", status: "canceled" },
      tutorSubscriptions: [{ tutorSku: "ADDON_TUTOR_CODING", status: "active" }],
    }),
  );
  assert.equal(skus.size, 0);
});

test("past_due subscription keeps tutors visible during Stripe retry", () => {
  // Stripe past_due is the configurable grace window before unpaid.
  // We don't want to gray out the entire shelf the second a card
  // declines — that's hostile UX. Server still enforces start.
  const skus = new Set(
    computeEffectiveTutorSkus({
      subscription: { plan: "family", status: "past_due" },
      tutorSubscriptions: [],
    }),
  );
  assert.equal(skus.size, 4);
});

test("grace_period add-on stays unlocked until graceEndsAt", () => {
  const skus = new Set(
    computeEffectiveTutorSkus({
      subscription: { plan: "single", status: "active" },
      tutorSubscriptions: [
        { tutorSku: "ADDON_TUTOR_CODING", status: "grace_period" },
        { tutorSku: "ADDON_TUTOR_ARTS", status: "canceled" },
      ],
    }),
  );
  assert.ok(skus.has("ADDON_TUTOR_CODING"));
  assert.ok(!skus.has("ADDON_TUTOR_ARTS"));
});

// ── Sprint 5: configurable past_due grace policy ───────────────────────────

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
    tutorSubscriptions: [{ tutorSku: "ADDON_TUTOR_CODING", status: "active" }],
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
