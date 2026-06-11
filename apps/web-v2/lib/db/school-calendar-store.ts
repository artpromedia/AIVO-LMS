/**
 * Wave B — dev/mock fallback store for the school-calendar surface
 * (ADR 0009 dual-path). brain-svc owns the real `school_calendars` tables;
 * in production the BFF always writes through to it (fail-closed when
 * `INTERNAL_SERVICE_TOKEN` is unset — see lib/bff/school-calendar.ts).
 * This in-memory mirror only serves dev/mock stacks so the parent/teacher
 * calendar UI works without brain-svc running.
 */

export type SchoolCalendarTerm = {
  termNumber: number;
  title: string | null;
  startDate: string;
  endDate: string;
};

export type SchoolCalendarBreak = {
  kind: "holiday" | "break" | "summer";
  name: string | null;
  startDate: string;
  endDate: string;
};

export type SchoolCalendar = {
  id: string;
  name: string | null;
  academicYear: string | null;
  timezone: string;
  terms: SchoolCalendarTerm[];
  breaks: SchoolCalendarBreak[];
};

const store = new Map<string, SchoolCalendar>();

function key(tenantId: string, learnerId: string): string {
  return `${tenantId}:${learnerId}`;
}

export function getStoredSchoolCalendar(
  tenantId: string,
  learnerId: string,
): SchoolCalendar | null {
  return store.get(key(tenantId, learnerId)) ?? null;
}

export function putStoredSchoolCalendar(
  tenantId: string,
  learnerId: string,
  calendar: Omit<SchoolCalendar, "id">,
): SchoolCalendar {
  const saved: SchoolCalendar = { id: `cal_dev_${learnerId}`, ...calendar };
  store.set(key(tenantId, learnerId), saved);
  return saved;
}

/** Test-only. */
export function __resetSchoolCalendarStoreForTests(): void {
  store.clear();
}
