/**
 * Unit tests for the pure logic in useBillingState. The hook itself
 * depends on React + fetch and is exercised by Playwright in Sprint 6;
 * here we lock down the trial-description helper used by the UI.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { describeTrial } from "../../src/hooks/useBillingState.js";

test("describeTrial returns null when there's no trial end", () => {
  assert.equal(describeTrial(null), null);
});

test("describeTrial returns null when the trial end already passed", () => {
  const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  assert.equal(describeTrial(past), null);
});

test("describeTrial returns null for non-parseable input", () => {
  assert.equal(describeTrial("not-a-date"), null);
});

test("describeTrial floors days remaining", () => {
  const now = new Date("2026-05-13T00:00:00.000Z");
  // 2 days and 3 hours ahead → 2 days remaining (floor)
  const trialEnd = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000);
  const result = describeTrial(trialEnd.toISOString(), now);
  assert.ok(result);
  assert.equal(result!.daysRemaining, 2);
});

test("describeTrial reports 0 days when ending today (within 24h)", () => {
  const now = new Date("2026-05-13T08:00:00.000Z");
  const trialEnd = new Date(now.getTime() + 6 * 60 * 60 * 1000);
  const result = describeTrial(trialEnd.toISOString(), now);
  assert.ok(result);
  assert.equal(result!.daysRemaining, 0);
});
