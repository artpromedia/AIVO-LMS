/**
 * Parent calendar aggregation.
 *
 * Pulls REAL, time-anchored events for the parent's learners into one typed
 * stream the calendar UI can render as month / week / agenda:
 *   - assignment due dates (teacher assignments with a `dueAt`)
 *   - completed lessons      (the day a LessonRun finished — activity log)
 *   - sessions               (human coach/therapy sessions — wired in once the
 *                             session model lands; the source is composable so
 *                             adding it is additive, not a rewrite)
 *
 * The pure helpers (grid building, day bucketing, range filtering) are
 * unit-tested and timezone-injectable so the UI can render in the viewer's own
 * zone deterministically.
 */
import type { ISODate } from "@/lib/db/types";
import {
  listLearnersForParent,
  listActiveAssignmentsForLearner,
  listLessonRunsForLearner,
  listSubjects,
} from "@/lib/db/repos";

export type CalendarEventKind = "assignment" | "lesson" | "session" | "therapy";

export type CalendarEvent = {
  id: string;
  kind: CalendarEventKind;
  /** Instant (or date-only ISO) the event is anchored to. */
  at: ISODate;
  /** Display-safe title (already localized/derived by the caller). */
  title: string;
  learnerId: string;
  learnerName: string;
  subjectName?: string | null;
  href?: string | null;
  /** Present only for events that can be rescheduled (sessions). */
  rescheduleHref?: string | null;
};

const DAY_MS = 86_400_000;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Civil YYYY-MM-DD for an ISO instant in `timeZone` (defaults to the runtime's
 * local zone). Date-only inputs are returned verbatim so a due date never
 * shifts a day across the UTC boundary.
 */
export function dayKeyInTz(iso: string, timeZone?: string): string {
  if (DATE_ONLY.test(iso)) return iso;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Add `n` months to a civil {year, month0}, normalizing overflow. */
export function addMonths(year: number, month0: number, n: number): { year: number; month0: number } {
  const total = year * 12 + month0 + n;
  return { year: Math.floor(total / 12), month0: ((total % 12) + 12) % 12 };
}

/**
 * The 6×7 day grid (Sunday-start) for the civil month, as date keys plus
 * whether each cell belongs to the month. Civil-date arithmetic in UTC keeps
 * the grid independent of any timezone.
 */
export function buildMonthGrid(
  year: number,
  month0: number,
): Array<{ dateKey: string; inMonth: boolean }> {
  const first = Date.UTC(year, month0, 1);
  const startDow = new Date(first).getUTCDay(); // 0 = Sunday
  const gridStart = first - startDow * DAY_MS;
  const cells: Array<{ dateKey: string; inMonth: boolean }> = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart + i * DAY_MS);
    cells.push({ dateKey: d.toISOString().slice(0, 10), inMonth: d.getUTCMonth() === month0 });
  }
  return cells;
}

/** The 7 day keys (Sunday-start) for the civil week containing `dateKey`. */
export function buildWeekKeys(dateKey: string): string[] {
  const base = Date.parse(`${dateKey}T00:00:00Z`);
  const dow = new Date(base).getUTCDay();
  const start = base - dow * DAY_MS;
  return Array.from({ length: 7 }, (_, i) => new Date(start + i * DAY_MS).toISOString().slice(0, 10));
}

/** Group events by their local day key, each day's list sorted ascending. */
export function groupEventsByDay(
  events: CalendarEvent[],
  timeZone?: string,
): Map<string, CalendarEvent[]> {
  const byDay = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const key = dayKeyInTz(e.at, timeZone);
    const list = byDay.get(key);
    if (list) list.push(e);
    else byDay.set(key, [e]);
  }
  for (const list of byDay.values()) {
    list.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.id.localeCompare(b.id)));
  }
  return byDay;
}

/** Events whose day key is in `[startKey, endKey]`, ascending — for agenda. */
export function eventsInDayRange(
  events: CalendarEvent[],
  startKey: string,
  endKey: string,
  timeZone?: string,
): CalendarEvent[] {
  return events
    .filter((e) => {
      const k = dayKeyInTz(e.at, timeZone);
      return k >= startKey && k <= endKey;
    })
    .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.id.localeCompare(b.id)));
}

/**
 * Fetch every real calendar event for the given parent, optionally scoped to a
 * subset of learners. `titles` supplies the localized noun for each kind so the
 * aggregator stays i18n-agnostic.
 */
export async function getCalendarEvents(input: {
  parentUserId: string;
  tenantId: string;
  learnerIds?: string[];
  titles: { assignment: string; lesson: string };
}): Promise<CalendarEvent[]> {
  const learners = await listLearnersForParent(input.parentUserId, input.tenantId);
  const scoped = input.learnerIds?.length
    ? learners.filter((l) => input.learnerIds!.includes(l.id))
    : learners;
  const subjects = new Map((await listSubjects()).map((s) => [s.id, s.name]));
  const events: CalendarEvent[] = [];

  for (const learner of scoped) {
    const [assignments, runs] = await Promise.all([
      listActiveAssignmentsForLearner(learner.id, input.tenantId),
      listLessonRunsForLearner(learner.id, input.tenantId),
    ]);

    for (const a of assignments) {
      if (!a.dueAt) continue;
      events.push({
        id: `assignment:${a.id}`,
        kind: "assignment",
        at: a.dueAt,
        title: a.title || input.titles.assignment,
        learnerId: learner.id,
        learnerName: learner.displayName,
        subjectName: subjects.get(a.subjectId) ?? null,
        href: `/parent/learners/${learner.id}/lessons`,
      });
    }

    for (const r of runs) {
      if (r.status !== "completed" || !r.completedAt) continue;
      events.push({
        id: `lesson:${r.id}`,
        kind: "lesson",
        at: r.completedAt,
        title: input.titles.lesson,
        learnerId: learner.id,
        learnerName: learner.displayName,
        subjectName: subjects.get(r.subjectId) ?? null,
        href: `/parent/learners/${learner.id}/summary`,
      });
    }
  }

  return events;
}
