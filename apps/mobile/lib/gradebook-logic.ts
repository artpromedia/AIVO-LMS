/**
 * Pure helpers for the learning-svc gradebook + lesson-session data
 * (real Postgres-backed endpoints:
 *   GET /api/learning/gradebook/:learnerId
 *   GET /api/learning/sessions?learnerId=…
 * ). Brand-free + side-effect-free so it is unit-testable in the vitest
 * node env; uses the app-side chart scale mirror.
 */
import {
  masteryLevelFromScore,
  normalizeScore,
  type MasteryLevel,
} from "../src/design/chart-scale";

export interface GradebookEntry {
  id?: string;
  subject: string;
  skill: string;
  /** 0..1 (real) — tolerant of 0..100 too. */
  masteryScore?: number | null;
  attemptsCount?: number | null;
  trend?: string | null;
  lastAssessedAt?: string | null;
}

export interface LessonSession {
  id: string;
  subject: string;
  tutorSku?: string | null;
  status?: string | null;
  contentType?: string | null;
  xpEarned?: number | null;
  durationSeconds?: number | null;
  startedAt?: string | null;
  completedAt?: string | null;
}

export interface SkillRow {
  skill: string;
  score: number; // 0..1
  level: MasteryLevel;
  trend: "up" | "down" | "stable";
}

export interface SubjectGrades {
  subject: string;
  average: number; // 0..100
  skills: SkillRow[];
}

function normTrend(t?: string | null): "up" | "down" | "stable" {
  const s = (t ?? "").toLowerCase();
  if (s.includes("up") || s.includes("improv") || s.includes("rising")) return "up";
  if (s.includes("down") || s.includes("declin") || s.includes("falling")) return "down";
  return "stable";
}

/** Group gradebook entries by subject with per-skill rows + a subject average. */
export function groupBySubject(entries: readonly GradebookEntry[]): SubjectGrades[] {
  const bySubject = new Map<string, SkillRow[]>();
  for (const e of entries) {
    const score = normalizeScore(e.masteryScore ?? 0);
    const row: SkillRow = {
      skill: e.skill,
      score,
      level: masteryLevelFromScore(e.masteryScore ?? 0),
      trend: normTrend(e.trend),
    };
    const list = bySubject.get(e.subject) ?? [];
    list.push(row);
    bySubject.set(e.subject, list);
  }
  const out: SubjectGrades[] = [];
  for (const [subject, skills] of bySubject) {
    skills.sort((a, b) => b.score - a.score);
    const average =
      skills.length === 0
        ? 0
        : Math.round((skills.reduce((s, r) => s + r.score, 0) / skills.length) * 100);
    out.push({ subject, average, skills });
  }
  out.sort((a, b) => b.average - a.average);
  return out;
}

/** Per-skill rows for a single subject (case-insensitive match). */
export function skillsForSubject(entries: readonly GradebookEntry[], subject: string): SkillRow[] {
  return (
    groupBySubject(entries).find((g) => g.subject.toLowerCase() === subject.toLowerCase())
      ?.skills ?? []
  );
}

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Count completed lessons per day over the last `days` days (oldest →
 * newest), labelled by weekday. `now` is injectable for tests.
 */
export function lessonsByDay(
  sessions: readonly LessonSession[],
  days = 7,
  now: number = Date.now(),
): { label: string; value: number }[] {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const start = today.getTime() - (days - 1) * DAY_MS;
  const buckets = new Array(days).fill(0);
  for (const s of sessions) {
    const ts = s.completedAt ?? s.startedAt;
    if (!ts) continue;
    const t = new Date(ts).getTime();
    if (Number.isNaN(t)) continue;
    const idx = Math.floor((t - start) / DAY_MS);
    if (idx >= 0 && idx < days) buckets[idx] += 1;
  }
  return buckets.map((value, i) => {
    const d = new Date(start + i * DAY_MS);
    return { label: WEEKDAY[d.getDay()], value };
  });
}

/** True when a session is finished. */
export function isCompleted(s: LessonSession): boolean {
  if (s.completedAt) return true;
  const st = (s.status ?? "").toUpperCase();
  return st === "COMPLETED" || st === "DONE";
}

/** Split lessons into completed (library) and in-progress (missions). */
export function splitLessons(sessions: readonly LessonSession[]): {
  completed: LessonSession[];
  inProgress: LessonSession[];
} {
  const completed: LessonSession[] = [];
  const inProgress: LessonSession[] = [];
  for (const s of sessions) (isCompleted(s) ? completed : inProgress).push(s);
  return { completed, inProgress };
}
