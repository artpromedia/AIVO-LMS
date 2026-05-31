import { describe, it, expect } from "vitest";
import {
  groupBySubject,
  skillsForSubject,
  lessonsByDay,
  splitLessons,
  isCompleted,
  type GradebookEntry,
  type LessonSession,
} from "../lib/gradebook-logic";

const ENTRIES: GradebookEntry[] = [
  { subject: "Math", skill: "Addition", masteryScore: 0.9, trend: "improving" },
  { subject: "Math", skill: "Subtraction", masteryScore: 0.4, trend: "declining" },
  { subject: "Reading", skill: "Phonics", masteryScore: 0.7, trend: "stable" },
];

describe("gradebook-logic", () => {
  it("groups entries by subject with averages, sorted strongest-first", () => {
    const groups = groupBySubject(ENTRIES);
    expect(groups.map((g) => g.subject)).toEqual(["Reading", "Math"]);
    const math = groups.find((g) => g.subject === "Math")!;
    expect(math.average).toBe(Math.round(((0.9 + 0.4) / 2) * 100)); // 65
    // skills sorted strongest-first within subject
    expect(math.skills.map((s) => s.skill)).toEqual(["Addition", "Subtraction"]);
    expect(math.skills[0].level).toBe("mastered");
    expect(math.skills[0].trend).toBe("up");
    expect(math.skills[1].trend).toBe("down");
  });

  it("filters skills for a subject case-insensitively", () => {
    expect(skillsForSubject(ENTRIES, "math").map((s) => s.skill)).toEqual([
      "Addition",
      "Subtraction",
    ]);
    expect(skillsForSubject(ENTRIES, "Science")).toEqual([]);
  });

  it("buckets lessons per day over a fixed window", () => {
    const now = new Date("2026-01-08T12:00:00Z").getTime();
    const sessions: LessonSession[] = [
      { id: "a", subject: "Math", completedAt: "2026-01-08T09:00:00Z" },
      { id: "b", subject: "Math", completedAt: "2026-01-08T10:00:00Z" },
      { id: "c", subject: "Reading", completedAt: "2026-01-06T10:00:00Z" },
      { id: "d", subject: "Reading", startedAt: "2025-12-01T10:00:00Z" }, // out of window
    ];
    const series = lessonsByDay(sessions, 7, now);
    expect(series).toHaveLength(7);
    expect(series[series.length - 1].value).toBe(2); // today
    expect(series.reduce((s, p) => s + p.value, 0)).toBe(3); // d excluded
  });

  it("classifies completed vs in-progress", () => {
    expect(isCompleted({ id: "1", subject: "Math", completedAt: "2026-01-01" })).toBe(true);
    expect(isCompleted({ id: "2", subject: "Math", status: "COMPLETED" })).toBe(true);
    expect(isCompleted({ id: "3", subject: "Math", status: "IN_PROGRESS" })).toBe(false);
    const { completed, inProgress } = splitLessons([
      { id: "1", subject: "Math", completedAt: "2026-01-01" },
      { id: "2", subject: "Math", status: "STARTED" },
    ]);
    expect(completed).toHaveLength(1);
    expect(inProgress).toHaveLength(1);
  });
});
