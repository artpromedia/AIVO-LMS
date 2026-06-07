import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  recordEfSessionOutcome,
  clamp01,
  normalizeEfModality,
} from "../src/lib/efOutcome.js";

/** Minimal drizzle-shaped fake that captures the inserted row. */
function fakeDb(captured: Record<string, unknown>[]) {
  return {
    insert() {
      return {
        values(v: Record<string, unknown>) {
          captured.push(v);
          return {
            async returning() {
              return [{ id: "ef_test_1", ...v }];
            },
          };
        },
      };
    },
  };
}

const VALID_TOD = new Set([
  "early-morning",
  "morning",
  "midday",
  "afternoon",
  "evening",
]);

describe("efOutcome helpers", () => {
  it("clamp01 bounds values into 0..1 and rejects NaN", () => {
    assert.equal(clamp01(-0.5), 0);
    assert.equal(clamp01(1.5), 1);
    assert.equal(clamp01(0.42), 0.42);
    assert.equal(clamp01(Number.NaN), 0);
  });

  it("normalizeEfModality only accepts the four EF modalities", () => {
    assert.equal(normalizeEfModality("visual"), "visual");
    assert.equal(normalizeEfModality("reading"), "reading");
    assert.equal(normalizeEfModality("tactile"), null);
    assert.equal(normalizeEfModality(undefined), null);
    assert.equal(normalizeEfModality(42), null);
  });

  it("recordEfSessionOutcome clamps, normalizes, and buckets time-of-day", async () => {
    const captured: Record<string, unknown>[] = [];
    const db = fakeDb(captured);
    const startedAt = new Date("2026-06-01T13:00:00Z");

    const result = await recordEfSessionOutcome(db, {
      tenantId: "t1",
      learnerId: "l1",
      startedAt,
      localHour: 9, // morning bucket regardless of UTC hour on startedAt
      subject: "x".repeat(200), // over the 64-char column limit
      modality: "bogus", // not an EF modality → null
      accuracy: 1.7, // clamps to 1
      frustrationRate: -3, // clamps to 0
      attentionMinutes: 1500.6, // rounds + caps at 1440
    });

    assert.equal(captured.length, 1);
    const row = captured[0]!;
    assert.equal(row.tenantId, "t1");
    assert.equal(row.learnerId, "l1");
    assert.equal((row.subject as string).length, 64);
    assert.equal(row.modality, null);
    assert.equal(row.accuracy, 1);
    assert.equal(row.frustrationRate, 0);
    assert.equal(row.attentionMinutes, 1440);
    assert.ok(VALID_TOD.has(row.timeOfDay as string));
    assert.equal(result.id, "ef_test_1");
    assert.equal(result.timeOfDay, row.timeOfDay);
  });

  it("falls back to startedAt hour when localHour is absent", async () => {
    const captured: Record<string, unknown>[] = [];
    const db = fakeDb(captured);
    // Construct a local-time Date so getHours() is deterministic for the bucket.
    const startedAt = new Date(2026, 5, 1, 20, 0, 0); // 8pm local → evening
    await recordEfSessionOutcome(db, {
      tenantId: "t1",
      learnerId: "l1",
      startedAt,
      accuracy: 0.5,
    });
    assert.equal(captured[0]!.timeOfDay, "evening");
    assert.equal(captured[0]!.frustrationRate, 0);
    assert.equal(captured[0]!.attentionMinutes, 0);
  });
});
