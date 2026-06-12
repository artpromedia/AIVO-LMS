/**
 * Remediation Sprint 06 — weekly wall-clock scheduling (`schedule:` option).
 *
 * The Creator's Sunday-night job must fire exactly once per week, on the
 * first tick after the target, regardless of tick cadence or downtime —
 * something the period-based `isDue` cannot express.
 */
import { test } from "node:test";
import assert from "node:assert";
import { isDueWeekly, lastWeeklyTarget, type WeeklySchedule } from "../src/index.js";

const SUNDAY_2300_UTC: WeeklySchedule = { dayOfWeek: 0, hour: 23 };

// 2026-06-14 is a Sunday.
const SUNDAY_TARGET = new Date(Date.UTC(2026, 5, 14, 23, 0, 0));

test("lastWeeklyTarget finds the most recent Sunday 23:00", () => {
  // Monday 03:00 → yesterday's target.
  assert.equal(
    lastWeeklyTarget(SUNDAY_2300_UTC, new Date(Date.UTC(2026, 5, 15, 3, 0))).getTime(),
    SUNDAY_TARGET.getTime(),
  );
  // Sunday 22:59 → LAST week's target (this week's hasn't happened yet).
  assert.equal(
    lastWeeklyTarget(SUNDAY_2300_UTC, new Date(Date.UTC(2026, 5, 14, 22, 59))).getTime(),
    Date.UTC(2026, 5, 7, 23, 0, 0),
  );
  // Exactly at the target → this week's target.
  assert.equal(
    lastWeeklyTarget(SUNDAY_2300_UTC, SUNDAY_TARGET).getTime(),
    SUNDAY_TARGET.getTime(),
  );
});

test("due inside the Sunday-night window, not before", () => {
  const lastRunAt = new Date(Date.UTC(2026, 5, 8, 23, 5)); // ran after last week's target
  // Saturday: not due.
  assert.equal(
    isDueWeekly({
      lastRunAt,
      now: new Date(Date.UTC(2026, 5, 13, 23, 30)),
      schedule: SUNDAY_2300_UTC,
    }),
    false,
  );
  // Sunday 23:01: due.
  assert.equal(
    isDueWeekly({
      lastRunAt,
      now: new Date(Date.UTC(2026, 5, 14, 23, 1)),
      schedule: SUNDAY_2300_UTC,
    }),
    true,
  );
});

test("runs once per week — a post-target run holds until the NEXT target", () => {
  const ranSundayNight = new Date(Date.UTC(2026, 5, 14, 23, 6));
  // Monday, Wednesday, next Sunday 22:00: not due again.
  for (const now of [
    Date.UTC(2026, 5, 15, 9, 0),
    Date.UTC(2026, 5, 17, 23, 30),
    Date.UTC(2026, 5, 21, 22, 0),
  ]) {
    assert.equal(
      isDueWeekly({ lastRunAt: ranSundayNight, now: new Date(now), schedule: SUNDAY_2300_UTC }),
      false,
      new Date(now).toISOString(),
    );
  }
  // Next Sunday 23:00 passed → due again.
  assert.equal(
    isDueWeekly({
      lastRunAt: ranSundayNight,
      now: new Date(Date.UTC(2026, 5, 21, 23, 10)),
      schedule: SUNDAY_2300_UTC,
    }),
    true,
  );
});

test("downtime across the target still fires once on recovery", () => {
  // Last ran two weeks ago; fleet slept through Sunday; Tuesday tick → due.
  assert.equal(
    isDueWeekly({
      lastRunAt: new Date(Date.UTC(2026, 5, 1, 0, 0)),
      now: new Date(Date.UTC(2026, 5, 16, 8, 0)),
      schedule: SUNDAY_2300_UTC,
    }),
    true,
  );
  // Never ran → due immediately after any target has passed.
  assert.equal(
    isDueWeekly({
      lastRunAt: null,
      now: new Date(Date.UTC(2026, 5, 16, 8, 0)),
      schedule: SUNDAY_2300_UTC,
    }),
    true,
  );
});

test("utcOffsetMinutes shifts the wall clock (Sunday 23:00 US-Eastern)", () => {
  const eastern: WeeklySchedule = { dayOfWeek: 0, hour: 23, utcOffsetMinutes: -300 };
  // Sunday 23:00 EST == Monday 04:00 UTC.
  assert.equal(
    lastWeeklyTarget(eastern, new Date(Date.UTC(2026, 5, 15, 5, 0))).getTime(),
    Date.UTC(2026, 5, 15, 4, 0),
  );
  // Ran right after LAST week's EST target; 03:00 UTC Monday is still
  // 22:00 Sunday EST — this week's target not reached, so not due.
  assert.equal(
    isDueWeekly({
      lastRunAt: new Date(Date.UTC(2026, 5, 8, 4, 30)),
      now: new Date(Date.UTC(2026, 5, 15, 3, 0)),
      schedule: eastern,
    }),
    false,
  );
  // One hour later (Monday 04:10 UTC = Sunday 23:10 EST) → due.
  assert.equal(
    isDueWeekly({
      lastRunAt: new Date(Date.UTC(2026, 5, 8, 4, 30)),
      now: new Date(Date.UTC(2026, 5, 15, 4, 10)),
      schedule: eastern,
    }),
    true,
  );
});
