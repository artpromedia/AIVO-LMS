import { describe, expect, it } from "vitest";
import { currentTermWindow, lastNDaysWindow } from "./report-window";

describe("currentTermWindow", () => {
  it("maps a fall date to the Aug-anchored window ending today", () => {
    const win = currentTermWindow(new Date(Date.UTC(2026, 9, 15))); // Oct 15 2026
    expect(win).toEqual({ startDate: "2026-08-01", endDate: "2026-10-15" });
  });

  it("keeps January inside the PREVIOUS year's fall term", () => {
    const win = currentTermWindow(new Date(Date.UTC(2027, 0, 10))); // Jan 10 2027
    expect(win).toEqual({ startDate: "2026-08-01", endDate: "2027-01-10" });
  });

  it("maps a spring date to the Feb-anchored window", () => {
    const win = currentTermWindow(new Date(Date.UTC(2026, 5, 10))); // Jun 10 2026
    expect(win).toEqual({ startDate: "2026-02-01", endDate: "2026-06-10" });
  });

  it("starts the fall term exactly on Aug 1", () => {
    const win = currentTermWindow(new Date(Date.UTC(2026, 7, 1))); // Aug 1 2026
    expect(win).toEqual({ startDate: "2026-08-01", endDate: "2026-08-01" });
  });

  it("never returns an endDate before startDate", () => {
    const win = currentTermWindow(new Date(Date.UTC(2027, 1, 1))); // Feb 1 2027
    expect(win.startDate <= win.endDate).toBe(true);
  });
});

describe("lastNDaysWindow", () => {
  it("returns an inclusive N-day window ending today", () => {
    const win = lastNDaysWindow(new Date(Date.UTC(2026, 5, 10)), 7);
    expect(win).toEqual({ startDate: "2026-06-04", endDate: "2026-06-10" });
  });

  it("crosses month and year boundaries correctly", () => {
    const win = lastNDaysWindow(new Date(Date.UTC(2026, 0, 3)), 7);
    expect(win).toEqual({ startDate: "2025-12-28", endDate: "2026-01-03" });
  });
});
