import { describe, expect, it } from "vitest";
import { deriveInsightHighlight } from "./insight-highlight";
import type { MasterySnapshot } from "@/lib/db/types";

const NOW = new Date("2026-06-15T00:00:00.000Z");

function snap(p: Partial<MasterySnapshot> & { subjectId: string; capturedAt: string; averageScore: number }): MasterySnapshot {
  return {
    id: p.id ?? `${p.subjectId}-${p.capturedAt}`,
    learnerId: "l1",
    tenantId: "t1",
    subjectId: p.subjectId,
    capturedAt: p.capturedAt,
    averageScore: p.averageScore,
    level: p.level ?? "approaching",
    skillsOnGradeLevel: p.skillsOnGradeLevel ?? 0,
    skillsTotal: p.skillsTotal ?? 0,
    deliveryLevel: p.deliveryLevel ?? null,
    gradeBand: p.gradeBand ?? null,
    trigger: p.trigger ?? "lesson",
  };
}

const name = (id: string) => ({ reading: "Reading", math: "Math" })[id] ?? id;

describe("deriveInsightHighlight", () => {
  it("returns null when there are no snapshots", () => {
    expect(deriveInsightHighlight([], name, { now: NOW })).toBeNull();
  });

  it("returns null when a subject has only one snapshot", () => {
    const out = deriveInsightHighlight(
      [snap({ subjectId: "reading", capturedAt: "2026-06-10T00:00:00Z", averageScore: 0.6 })],
      name,
      { now: NOW },
    );
    expect(out).toBeNull();
  });

  it("derives a reproducible mastery improvement with provenance", () => {
    const out = deriveInsightHighlight(
      [
        snap({ subjectId: "reading", capturedAt: "2026-06-01T00:00:00Z", averageScore: 0.47 }),
        snap({ subjectId: "reading", capturedAt: "2026-06-12T00:00:00Z", averageScore: 0.65 }),
      ],
      name,
      { now: NOW },
    );
    expect(out).not.toBeNull();
    expect(out!.subjectName).toBe("Reading");
    expect(out!.direction).toBe("up");
    expect(out!.fromPct).toBe(47);
    expect(out!.toPct).toBe(65);
    expect(out!.deltaPoints).toBe(18);
    expect(out!.source).toBe("mastery_snapshots");
    expect(out!.windowDays).toBe(30);
    expect(out!.sampleSize).toBe(2);
    expect(out!.fromDate).toBe("2026-06-01T00:00:00Z");
    expect(out!.toDate).toBe("2026-06-12T00:00:00Z");
  });

  it("ignores changes below the minimum delta threshold", () => {
    const out = deriveInsightHighlight(
      [
        snap({ subjectId: "math", capturedAt: "2026-06-01T00:00:00Z", averageScore: 0.6 }),
        snap({ subjectId: "math", capturedAt: "2026-06-12T00:00:00Z", averageScore: 0.63 }),
      ],
      name,
      { now: NOW },
    );
    expect(out).toBeNull();
  });

  it("ignores same-day captures (no real time span)", () => {
    const out = deriveInsightHighlight(
      [
        snap({ subjectId: "reading", capturedAt: "2026-06-14T08:00:00Z", averageScore: 0.4 }),
        snap({ subjectId: "reading", capturedAt: "2026-06-14T09:00:00Z", averageScore: 0.7 }),
      ],
      name,
      { now: NOW },
    );
    expect(out).toBeNull();
  });

  it("excludes snapshots older than the window", () => {
    const out = deriveInsightHighlight(
      [
        snap({ subjectId: "reading", capturedAt: "2026-01-01T00:00:00Z", averageScore: 0.2 }),
        snap({ subjectId: "reading", capturedAt: "2026-06-12T00:00:00Z", averageScore: 0.65 }),
      ],
      name,
      { now: NOW, windowDays: 30 },
    );
    // Only one snapshot falls inside the 30-day window → not enough to compare.
    expect(out).toBeNull();
  });

  it("leads with the strongest improvement when several subjects improved", () => {
    const out = deriveInsightHighlight(
      [
        snap({ subjectId: "reading", capturedAt: "2026-06-01T00:00:00Z", averageScore: 0.5 }),
        snap({ subjectId: "reading", capturedAt: "2026-06-12T00:00:00Z", averageScore: 0.6 }), // +10
        snap({ subjectId: "math", capturedAt: "2026-06-01T00:00:00Z", averageScore: 0.4 }),
        snap({ subjectId: "math", capturedAt: "2026-06-12T00:00:00Z", averageScore: 0.7 }), // +30
      ],
      name,
      { now: NOW },
    );
    expect(out!.subjectName).toBe("Math");
    expect(out!.deltaPoints).toBe(30);
  });

  it("surfaces a decline only when nothing improved (never hides a regression)", () => {
    const out = deriveInsightHighlight(
      [
        snap({ subjectId: "reading", capturedAt: "2026-06-01T00:00:00Z", averageScore: 0.7 }),
        snap({ subjectId: "reading", capturedAt: "2026-06-12T00:00:00Z", averageScore: 0.55 }),
      ],
      name,
      { now: NOW },
    );
    expect(out!.direction).toBe("down");
    expect(out!.deltaPoints).toBe(15);
  });

  it("is deterministic across input ordering", () => {
    const rows = [
      snap({ subjectId: "math", capturedAt: "2026-06-12T00:00:00Z", averageScore: 0.7 }),
      snap({ subjectId: "math", capturedAt: "2026-06-01T00:00:00Z", averageScore: 0.4 }),
    ];
    const a = deriveInsightHighlight(rows, name, { now: NOW });
    const b = deriveInsightHighlight([...rows].reverse(), name, { now: NOW });
    expect(a).toEqual(b);
  });
});
