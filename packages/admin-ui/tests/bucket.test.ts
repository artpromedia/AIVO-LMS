import { describe, expect, it } from "vitest";
import { bucketByDay, cumulativeOverTime } from "../src/bucket.js";

interface Row {
  createdAt: string | Date;
}

const byCreatedAt = (row: Row) => row.createdAt;

describe("bucketByDay", () => {
  it("returns an empty series for an empty list", () => {
    expect(bucketByDay([], byCreatedAt)).toEqual([]);
  });

  it("buckets a single day into one point", () => {
    const rows: Row[] = [
      { createdAt: "2026-06-10T01:00:00.000Z" },
      { createdAt: "2026-06-10T13:30:00.000Z" },
      { createdAt: new Date("2026-06-10T23:59:59.000Z") },
    ];
    expect(bucketByDay(rows, byCreatedAt)).toEqual([{ t: "2026-06-10", value: 3 }]);
  });

  it("zero-fills the gap days across a multi-day range", () => {
    const rows: Row[] = [
      { createdAt: "2026-06-06T12:00:00.000Z" },
      { createdAt: "2026-06-06T15:00:00.000Z" },
      { createdAt: "2026-06-09T08:00:00.000Z" },
    ];
    expect(bucketByDay(rows, byCreatedAt)).toEqual([
      { t: "2026-06-06", value: 2 },
      { t: "2026-06-07", value: 0 },
      { t: "2026-06-08", value: 0 },
      { t: "2026-06-09", value: 1 },
    ]);
  });

  it("does not depend on input order", () => {
    const rows: Row[] = [
      { createdAt: "2026-06-09T08:00:00.000Z" },
      { createdAt: "2026-06-06T12:00:00.000Z" },
    ];
    expect(bucketByDay(rows, byCreatedAt).map((p) => p.t)).toEqual([
      "2026-06-06",
      "2026-06-07",
      "2026-06-08",
      "2026-06-09",
    ]);
  });

  it("splits items around a UTC midnight boundary into different buckets", () => {
    // One second before and one second after midnight UTC. Bucketing is
    // UTC-keyed, so this holds regardless of the host timezone.
    const rows: Row[] = [
      { createdAt: "2026-06-09T23:59:59.000Z" },
      { createdAt: "2026-06-10T00:00:01.000Z" },
    ];
    expect(bucketByDay(rows, byCreatedAt)).toEqual([
      { t: "2026-06-09", value: 1 },
      { t: "2026-06-10", value: 1 },
    ]);
  });

  it("buckets non-UTC offsets by their UTC instant", () => {
    // 2026-06-10T01:30+02:00 is 2026-06-09T23:30Z — it belongs to June 9 UTC.
    const rows: Row[] = [{ createdAt: "2026-06-10T01:30:00.000+02:00" }];
    expect(bucketByDay(rows, byCreatedAt)).toEqual([{ t: "2026-06-09", value: 1 }]);
  });
});

describe("cumulativeOverTime", () => {
  it("returns an empty series for an empty list", () => {
    expect(cumulativeOverTime([], byCreatedAt)).toEqual([]);
  });

  it("accumulates the running total across the zero-filled window", () => {
    const rows: Row[] = [
      { createdAt: "2026-06-06T12:00:00.000Z" },
      { createdAt: "2026-06-06T15:00:00.000Z" },
      { createdAt: "2026-06-08T08:00:00.000Z" },
    ];
    expect(cumulativeOverTime(rows, byCreatedAt)).toEqual([
      { t: "2026-06-06", value: 2 },
      { t: "2026-06-07", value: 2 },
      { t: "2026-06-08", value: 3 },
    ]);
  });
});
