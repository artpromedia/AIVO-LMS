/**
 * Tests for the pure "what's working" insight builder. No DB / no
 * Fastify so the tests run regardless of DATABASE_URL.
 */
// Pin timezone so local-hour bucketing is deterministic across CI / dev hosts.
// Must run before any Date is constructed.
process.env.TZ = "UTC";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeWhatsWorking,
  bucketLocalHour,
  type SessionRow,
} from "../src/services/whats-working.js";

const NOW = new Date("2026-04-29T18:00:00Z");

function row(overrides: Partial<SessionRow> = {}): SessionRow {
  return {
    startedAt: "2026-04-25T09:00:00Z",
    subject: "math",
    accuracy: 0.8,
    frustrationRate: 0.1,
    attentionMinutes: 15,
    modality: "visual",
    ...overrides,
  };
}

test("bucketLocalHour partitions hours correctly", () => {
  assert.equal(bucketLocalHour(6), "early-morning");
  assert.equal(bucketLocalHour(9), "morning");
  assert.equal(bucketLocalHour(12), "midday");
  assert.equal(bucketLocalHour(15), "afternoon");
  assert.equal(bucketLocalHour(20), "evening");
});

test("returns no insights for empty input", () => {
  const r = computeWhatsWorking([], { now: NOW });
  assert.equal(r.totalSessions, 0);
  assert.equal(r.bestWindow, null);
  assert.deepEqual(r.timeOfDay, []);
});

test("excludes sessions outside the trailing window", () => {
  const rows: SessionRow[] = [
    row({ startedAt: "2026-04-28T09:00:00Z" }),
    row({ startedAt: "2026-04-27T09:00:00Z" }),
    // > 30 days old → excluded.
    row({ startedAt: "2026-03-01T09:00:00Z" }),
  ];
  const r = computeWhatsWorking(rows, { now: NOW, windowDays: 30 });
  assert.equal(r.totalSessions, 2);
});

test("ranks time-of-day windows by composite score", () => {
  const rows: SessionRow[] = [
    // Strong morning sessions.
    row({
      startedAt: "2026-04-28T09:00:00Z",
      accuracy: 0.9,
      frustrationRate: 0.05,
      attentionMinutes: 25,
    }),
    row({
      startedAt: "2026-04-27T09:30:00Z",
      accuracy: 0.85,
      frustrationRate: 0.1,
      attentionMinutes: 22,
    }),
    // Weak afternoon sessions.
    row({
      startedAt: "2026-04-28T15:00:00Z",
      accuracy: 0.5,
      frustrationRate: 0.5,
      attentionMinutes: 8,
    }),
    row({
      startedAt: "2026-04-27T16:00:00Z",
      accuracy: 0.45,
      frustrationRate: 0.55,
      attentionMinutes: 6,
    }),
  ];
  const r = computeWhatsWorking(rows, { now: NOW });
  // Server interprets startedAt in *local* time. The assertion is loose
  // about the bucket name (depends on local TZ of the test runner) and
  // focuses on the ranking — best window must outscore the worst.
  assert.ok(r.bestWindow);
  assert.ok(r.timeOfDay.length >= 2);
  for (let i = 1; i < r.timeOfDay.length; i++) {
    assert.ok(r.timeOfDay[i - 1].score >= r.timeOfDay[i].score);
  }
});

test("does not endorse a single-session window as best", () => {
  const rows: SessionRow[] = [row({ startedAt: "2026-04-28T09:00:00Z", accuracy: 0.95 })];
  const r = computeWhatsWorking(rows, { now: NOW });
  assert.equal(r.bestWindow, null);
});

test("identifies frustration hotspots only when ≥0.2 mean rate", () => {
  const rows: SessionRow[] = [
    row({ subject: "ela", modality: "reading", accuracy: 0.4, frustrationRate: 0.6 }),
    row({ subject: "ela", modality: "reading", accuracy: 0.45, frustrationRate: 0.55 }),
    // Math/visual is fine — no hotspot.
    row({ subject: "math", modality: "visual", accuracy: 0.9, frustrationRate: 0.05 }),
    row({ subject: "math", modality: "visual", accuracy: 0.85, frustrationRate: 0.07 }),
  ];
  const r = computeWhatsWorking(rows, { now: NOW });
  assert.equal(r.frustrationHotspots.length, 1);
  assert.equal(r.frustrationHotspots[0].subject, "ela");
  assert.equal(r.frustrationHotspots[0].modality, "reading");
});

test("modality-fit matrix orders modalities by accuracy within subject", () => {
  const rows: SessionRow[] = [
    row({ subject: "math", modality: "visual", accuracy: 0.9 }),
    row({ subject: "math", modality: "visual", accuracy: 0.85 }),
    row({ subject: "math", modality: "reading", accuracy: 0.5 }),
    row({ subject: "math", modality: "reading", accuracy: 0.45 }),
  ];
  const r = computeWhatsWorking(rows, { now: NOW });
  assert.equal(r.modalityFit.length, 2);
  assert.equal(r.modalityFit[0].modality, "visual");
  assert.equal(r.modalityFit[1].modality, "reading");
});

test("excludes sessions missing subject or modality from the fit matrix", () => {
  const rows: SessionRow[] = [
    row({ subject: undefined, modality: "visual" }),
    row({ subject: "math", modality: undefined }),
    row({ subject: "math", modality: "visual" }),
    row({ subject: "math", modality: "visual" }),
  ];
  const r = computeWhatsWorking(rows, { now: NOW });
  // Only 2 fully-tagged rows in the matrix.
  assert.equal(r.modalityFit.length, 1);
  assert.equal(r.modalityFit[0].sessions, 2);
});
