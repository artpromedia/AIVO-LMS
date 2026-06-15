import { describe, expect, it } from "vitest";
import {
  dayKeyInTz,
  addMonths,
  buildMonthGrid,
  buildWeekKeys,
  groupEventsByDay,
  eventsInDayRange,
  type CalendarEvent,
} from "./calendar";

function ev(p: Partial<CalendarEvent> & { id: string; at: string }): CalendarEvent {
  return {
    id: p.id,
    kind: p.kind ?? "assignment",
    at: p.at,
    title: p.title ?? "Event",
    learnerId: p.learnerId ?? "l1",
    learnerName: p.learnerName ?? "Ada",
    subjectName: p.subjectName ?? null,
    href: p.href ?? null,
  };
}

describe("dayKeyInTz", () => {
  it("returns date-only inputs verbatim (no UTC-boundary shift)", () => {
    expect(dayKeyInTz("2026-06-12")).toBe("2026-06-12");
  });
  it("buckets an instant into the target zone's civil day", () => {
    // 03:00 UTC on the 12th is still the 11th in New York (UTC-4 in June).
    expect(dayKeyInTz("2026-06-12T03:00:00Z", "America/New_York")).toBe("2026-06-11");
    expect(dayKeyInTz("2026-06-12T03:00:00Z", "UTC")).toBe("2026-06-12");
  });
});

describe("addMonths", () => {
  it("normalizes overflow and underflow", () => {
    expect(addMonths(2026, 11, 1)).toEqual({ year: 2027, month0: 0 });
    expect(addMonths(2026, 0, -1)).toEqual({ year: 2025, month0: 11 });
  });
});

describe("buildMonthGrid", () => {
  it("produces 42 cells starting on a Sunday", () => {
    const grid = buildMonthGrid(2026, 5); // June 2026
    expect(grid).toHaveLength(42);
    expect(new Date(`${grid[0].dateKey}T00:00:00Z`).getUTCDay()).toBe(0);
  });
  it("flags in-month vs spillover days", () => {
    const grid = buildMonthGrid(2026, 5);
    const inMonth = grid.filter((c) => c.inMonth);
    expect(inMonth).toHaveLength(30); // June has 30 days
    expect(inMonth[0].dateKey).toBe("2026-06-01");
    expect(inMonth.at(-1)!.dateKey).toBe("2026-06-30");
  });
});

describe("buildWeekKeys", () => {
  it("returns the Sunday-start week containing the date", () => {
    const week = buildWeekKeys("2026-06-12"); // a Friday
    expect(week).toHaveLength(7);
    expect(week[0]).toBe("2026-06-07"); // Sunday
    expect(week[6]).toBe("2026-06-13"); // Saturday
    expect(week).toContain("2026-06-12");
  });
});

describe("groupEventsByDay", () => {
  it("groups by local day and sorts each day ascending", () => {
    const grouped = groupEventsByDay(
      [
        ev({ id: "b", at: "2026-06-12T15:00:00Z" }),
        ev({ id: "a", at: "2026-06-12T09:00:00Z" }),
        ev({ id: "c", at: "2026-06-13T09:00:00Z" }),
      ],
      "UTC",
    );
    expect(grouped.get("2026-06-12")!.map((e) => e.id)).toEqual(["a", "b"]);
    expect(grouped.get("2026-06-13")!.map((e) => e.id)).toEqual(["c"]);
  });
});

describe("eventsInDayRange", () => {
  it("includes only events within the inclusive day range, ascending", () => {
    const out = eventsInDayRange(
      [
        ev({ id: "before", at: "2026-06-06" }),
        ev({ id: "in1", at: "2026-06-08" }),
        ev({ id: "in2", at: "2026-06-10" }),
        ev({ id: "after", at: "2026-06-20" }),
      ],
      "2026-06-07",
      "2026-06-13",
      "UTC",
    );
    expect(out.map((e) => e.id)).toEqual(["in1", "in2"]);
  });
});
