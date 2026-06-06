/**
 * Trial + pilot conversion math — pure, no DB.
 */
import { test } from "node:test";
import assert from "node:assert";
import { computeTrialConversion, type TrialRow } from "../src/lib/trial-conversion.js";

const NOW = new Date("2026-06-06T00:00:00Z");
const days = (n: number) => new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000);

test("counts trials, conversions, and rate over the last 30 days", () => {
  const rows: TrialRow[] = [
    // Started 10d ago, still trialing, ends in 4 days (not within 7? 4 is within 7).
    { status: "TRIALING", trialEndsAt: days(4), createdAt: days(-10), metadata: null },
    // Started 5d ago, converted to paid.
    { status: "ACTIVE", trialEndsAt: days(-1), createdAt: days(-5), metadata: null },
    // Started 40d ago — outside the 30d window.
    { status: "ACTIVE", trialEndsAt: days(-30), createdAt: days(-40), metadata: null },
    // Never a trial (no trialEndsAt) — ignored for trial metrics.
    { status: "ACTIVE", trialEndsAt: null, createdAt: days(-3), metadata: null },
  ];
  const r = computeTrialConversion(rows, NOW);
  assert.equal(r.trialsStartedLast30d, 2); // the two trials within 30d
  assert.equal(r.trialingNow, 1);
  assert.equal(r.trialsEndingIn7d, 1);
  assert.equal(r.convertedLast30d, 1);
  assert.equal(r.conversionRateLast30d, 0.5);
});

test("computes pilot-coupon conversion from metadata.couponCode", () => {
  const rows: TrialRow[] = [
    {
      status: "ACTIVE",
      trialEndsAt: null,
      createdAt: days(-2),
      metadata: { couponCode: "PILOT-A" },
    },
    {
      status: "CANCELLED",
      trialEndsAt: null,
      createdAt: days(-2),
      metadata: { couponCode: "PILOT-B" },
    },
    { status: "ACTIVE", trialEndsAt: null, createdAt: days(-2), metadata: { other: "x" } },
  ];
  const r = computeTrialConversion(rows, NOW);
  assert.equal(r.pilotsStarted, 2);
  assert.equal(r.pilotsConverted, 1);
  assert.equal(r.pilotConversionRate, 0.5);
});

test("rates are 0 when denominators are 0", () => {
  const r = computeTrialConversion([], NOW);
  assert.equal(r.conversionRateLast30d, 0);
  assert.equal(r.pilotConversionRate, 0);
});
