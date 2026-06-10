/**
 * Mastery-signal emitter (Sprint 4): payload shape, level bucketing, and
 * flag/fetch gating.
 */
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  buildMasterySignals,
  emitMasterySignals,
  masteryLevelFromScore,
} from "../src/services/mastery-signal-emitter.js";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  delete process.env.AIVO_FEATURE_PROFILE_RECOMMENDATIONS_V2;
});

test("buildMasterySignals carries the metadata the progression rules read", () => {
  const [signal] = buildMasterySignals([
    { skillId: "skl-1", subjectId: "math", before: 0.5, after: 0.7 },
  ]);
  assert.equal(signal!.metric, "mastery_signal");
  assert.equal(signal!.source, "lesson");
  assert.equal(signal!.value, 0.7);
  assert.deepEqual(signal!.metadata, {
    skillId: "skl-1",
    subjectId: "math",
    before: 0.5,
    after: 0.7,
    levelBefore: "approaching",
    levelAfter: "on_grade_level",
  });
});

test("masteryLevelFromScore buckets match the web pipeline", () => {
  assert.equal(masteryLevelFromScore(0.9), "stretching");
  assert.equal(masteryLevelFromScore(0.65), "on_grade_level");
  assert.equal(masteryLevelFromScore(0.5), "approaching");
  assert.equal(masteryLevelFromScore(0.1), "emerging");
  assert.equal(masteryLevelFromScore(0), "not_started");
});

test("emitMasterySignals posts the candidates payload when the flag is on", async () => {
  process.env.AIVO_FEATURE_PROFILE_RECOMMENDATIONS_V2 = "1";
  const calls: Array<{ url: string; body: any }> = [];
  globalThis.fetch = (async (url: any, init: any) => {
    calls.push({ url: String(url), body: JSON.parse(init.body) });
    return new Response("{}", { status: 200 });
  }) as typeof fetch;

  await emitMasterySignals({
    tenantId: "t-1",
    learnerId: "lrn-1",
    movements: [{ skillId: "skl-1", subjectId: "math", before: 0.5, after: 0.7 }],
    currentProfile: { deliveryLevel: "3", gradeBand: "5", baselineCompletedAt: "2026-01-01T00:00:00.000Z" },
  });

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.url, /\/api\/recommendations\/candidates$/);
  assert.equal(calls[0]!.body.learnerId, "lrn-1");
  assert.equal(calls[0]!.body.tenantId, "t-1");
  assert.equal(calls[0]!.body.signals.length, 1);
  assert.equal(calls[0]!.body.currentProfile.gradeBand, "5");
});

test("emitMasterySignals is a no-op when the flag is off or nothing moved", async () => {
  let called = 0;
  globalThis.fetch = (async () => {
    called += 1;
    return new Response("{}");
  }) as typeof fetch;

  await emitMasterySignals({
    tenantId: "t-1",
    learnerId: "lrn-1",
    movements: [{ skillId: "s", subjectId: "m", before: 0, after: 0.5 }],
  });
  process.env.AIVO_FEATURE_PROFILE_RECOMMENDATIONS_V2 = "1";
  await emitMasterySignals({ tenantId: "t-1", learnerId: "lrn-1", movements: [] });
  assert.equal(called, 0);
});

test("emitMasterySignals swallows network failures", async () => {
  process.env.AIVO_FEATURE_PROFILE_RECOMMENDATIONS_V2 = "1";
  globalThis.fetch = (async () => {
    throw new Error("ECONNREFUSED");
  }) as typeof fetch;
  await emitMasterySignals({
    tenantId: "t-1",
    learnerId: "lrn-1",
    movements: [{ skillId: "s", subjectId: "m", before: 0, after: 0.5 }],
  });
});
