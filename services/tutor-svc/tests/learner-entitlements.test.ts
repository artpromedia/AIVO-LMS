import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type {
  SubscriptionRecord,
  TutorSubscriptionRecord,
} from "@aivo/billing-entitlements";
import { projectLearnerEntitlements } from "../src/lib/learner-entitlements.js";

const LEARNER = "11111111-1111-4111-8111-111111111111";
const TENANT = "22222222-2222-4222-8222-222222222222";

function withSub(overrides: Partial<SubscriptionRecord>): SubscriptionRecord {
  return {
    plan: "single",
    status: "active",
    cancelAtPeriodEnd: false,
    currentPeriodEnd: null,
    ...overrides,
  };
}

describe("projectLearnerEntitlements", () => {
  it("free plan only unlocks Sage (ELA)", () => {
    const payload = projectLearnerEntitlements({
      learnerId: LEARNER,
      tenantId: TENANT,
      subscription: withSub({ plan: "free" }),
      tutorSubscriptions: [],
    });
    assert.deepEqual(payload.includedTutors, ["sage"]);
    assert.deepEqual(payload.addonTutors, []);
    assert.deepEqual(payload.graceTutors, []);
    assert.deepEqual(payload.effectiveTutors.sort(), ["sage"]);
    assert.ok(payload.lockedTutors.includes("nova"));
    assert.ok(payload.lockedTutors.includes("pixel"));
    assert.equal(payload.subscriptionStatus, "active");
  });

  it("single plan unlocks core 4 (nova, sage, spark, chrono)", () => {
    const payload = projectLearnerEntitlements({
      learnerId: LEARNER,
      tenantId: TENANT,
      subscription: withSub({ plan: "single" }),
      tutorSubscriptions: [],
    });
    assert.deepEqual(
      payload.effectiveTutors.sort(),
      ["chrono", "nova", "sage", "spark"],
    );
  });

  it("active add-on unlocks the corresponding tutor key (nova → ADDON_TUTOR_MATH bug)", () => {
    const payload = projectLearnerEntitlements({
      learnerId: LEARNER,
      tenantId: TENANT,
      subscription: withSub({ plan: "free" }),
      tutorSubscriptions: [
        { tutorSku: "ADDON_TUTOR_MATH", status: "active" },
      ],
    });
    assert.ok(payload.effectiveTutors.includes("nova"), "nova should unlock from ADDON_TUTOR_MATH");
    assert.ok(payload.addonTutors.includes("nova"));
    assert.equal(payload.lockedTutors.includes("nova"), false);
  });

  it("grace-period add-on still unlocks the tutor and is flagged as grace", () => {
    const payload = projectLearnerEntitlements({
      learnerId: LEARNER,
      tenantId: TENANT,
      subscription: withSub({ plan: "free" }),
      tutorSubscriptions: [
        { tutorSku: "ADDON_TUTOR_CODING", status: "grace_period" },
      ],
    });
    assert.ok(payload.effectiveTutors.includes("pixel"));
    assert.ok(payload.graceTutors.includes("pixel"));
    assert.equal(payload.addonTutors.includes("pixel"), false);
  });

  it("inactive add-on stays locked", () => {
    const payload = projectLearnerEntitlements({
      learnerId: LEARNER,
      tenantId: TENANT,
      subscription: withSub({ plan: "free" }),
      tutorSubscriptions: [
        { tutorSku: "ADDON_TUTOR_CODING", status: "inactive" },
        { tutorSku: "ADDON_TUTOR_MATH", status: "canceled" },
      ],
    });
    assert.equal(payload.effectiveTutors.includes("pixel"), false);
    assert.equal(payload.effectiveTutors.includes("nova"), false);
  });

  it("district plan unlocks all 14 tutors", () => {
    const payload = projectLearnerEntitlements({
      learnerId: LEARNER,
      tenantId: TENANT,
      subscription: withSub({ plan: "district" }),
      tutorSubscriptions: [],
    });
    assert.equal(payload.effectiveTutors.length, 14);
    assert.equal(payload.lockedTutors.length, 0);
  });

  it("missing subscription locks everything", () => {
    const payload = projectLearnerEntitlements({
      learnerId: LEARNER,
      tenantId: TENANT,
      subscription: null,
      tutorSubscriptions: [
        { tutorSku: "ADDON_TUTOR_MATH", status: "active" },
      ],
    });
    assert.equal(payload.subscriptionStatus, "missing");
    assert.equal(payload.plan, "unknown");
    assert.equal(payload.effectiveTutors.length, 0);
    assert.equal(payload.lockedTutors.length, 14);
  });

  it("canceled subscription locks everything even with active add-ons", () => {
    const payload = projectLearnerEntitlements({
      learnerId: LEARNER,
      tenantId: TENANT,
      subscription: withSub({ plan: "single", status: "canceled" }),
      tutorSubscriptions: [
        { tutorSku: "ADDON_TUTOR_MATH", status: "active" },
      ],
    });
    assert.equal(payload.effectiveTutors.length, 0);
    assert.equal(payload.lockedTutors.length, 14);
  });

  it("ignores tutor subscriptions with unknown SKUs", () => {
    const payload = projectLearnerEntitlements({
      learnerId: LEARNER,
      tenantId: TENANT,
      subscription: withSub({ plan: "free" }),
      // @ts-expect-error intentionally bad SKU
      tutorSubscriptions: [{ tutorSku: "NOT_A_REAL_SKU", status: "active" }],
    });
    assert.deepEqual(payload.effectiveTutors.sort(), ["sage"]);
  });
});
