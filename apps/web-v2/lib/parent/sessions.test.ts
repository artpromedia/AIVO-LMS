import { describe, expect, it } from "vitest";
import { localDayTime, isWithinAvailability, hasConflict, isFuture } from "./sessions";
import type { Provider, CoachingSession } from "@/lib/db/types";

const provider: Provider = {
  id: "p1",
  tenantId: "t1",
  userId: null,
  kind: "coach",
  displayName: "Emma",
  specialty: "Learning coach",
  bio: null,
  timezone: "UTC",
  availability: [{ dayOfWeek: 1, startHour: 9, endHour: 17 }], // Mondays 09:00–17:00 UTC
  createdAt: "2026-01-01T00:00:00Z",
};

function session(p: Partial<CoachingSession> & { id: string; scheduledStart: string }): CoachingSession {
  return {
    id: p.id,
    tenantId: "t1",
    learnerId: "l1",
    providerId: p.providerId ?? "p1",
    parentUserId: "parent1",
    kind: "coach",
    title: "Session",
    scheduledStart: p.scheduledStart,
    durationMinutes: p.durationMinutes ?? 30,
    location: "video",
    status: p.status ?? "scheduled",
    feedback: null,
    cancelReason: null,
    rescheduleHistory: [],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
}

describe("localDayTime", () => {
  it("resolves weekday/hour in the target zone", () => {
    // 2026-06-15 is a Monday. 14:30 UTC.
    expect(localDayTime("2026-06-15T14:30:00Z", "UTC")).toEqual({ dayOfWeek: 1, hour: 14, minute: 30 });
  });
});

describe("isWithinAvailability", () => {
  it("accepts a slot inside a window", () => {
    // Monday 2026-06-15, 10:00–10:30 UTC → inside Mon 09–17.
    expect(isWithinAvailability(provider, "2026-06-15T10:00:00Z", 30)).toBe(true);
  });
  it("rejects a slot outside the window's hours", () => {
    expect(isWithinAvailability(provider, "2026-06-15T18:00:00Z", 30)).toBe(false);
  });
  it("rejects a slot that runs past the window end", () => {
    expect(isWithinAvailability(provider, "2026-06-15T16:45:00Z", 30)).toBe(false);
  });
  it("rejects a slot on a day with no window", () => {
    // 2026-06-16 is a Tuesday.
    expect(isWithinAvailability(provider, "2026-06-16T10:00:00Z", 30)).toBe(false);
  });
});

describe("hasConflict", () => {
  const existing = [session({ id: "s1", scheduledStart: "2026-06-15T10:00:00Z", durationMinutes: 30 })];
  it("detects overlap with a scheduled session", () => {
    expect(hasConflict(existing, "p1", "2026-06-15T10:15:00Z", 30)).toBe(true);
  });
  it("allows a non-overlapping slot", () => {
    expect(hasConflict(existing, "p1", "2026-06-15T10:30:00Z", 30)).toBe(false);
  });
  it("ignores the session being rescheduled", () => {
    expect(hasConflict(existing, "p1", "2026-06-15T10:00:00Z", 30, "s1")).toBe(false);
  });
  it("ignores cancelled sessions", () => {
    const cancelled = [session({ id: "s2", scheduledStart: "2026-06-15T10:00:00Z", status: "cancelled" })];
    expect(hasConflict(cancelled, "p1", "2026-06-15T10:00:00Z", 30)).toBe(false);
  });
});

describe("isFuture", () => {
  it("is true only for instants after now", () => {
    const now = Date.parse("2026-06-15T12:00:00Z");
    expect(isFuture("2026-06-15T13:00:00Z", now)).toBe(true);
    expect(isFuture("2026-06-15T11:00:00Z", now)).toBe(false);
  });
});
