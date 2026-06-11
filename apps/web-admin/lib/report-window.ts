/**
 * Rolling report windows for admin dashboards.
 *
 * Dashboards must never pin report queries to literal dates (the school
 * engagement panel shipped frozen to fall 2024 — Sprint A1). These helpers
 * derive the window from "now" so every render queries the current period.
 *
 * Term boundaries follow the US school year the reports engine assumes:
 *   Aug 1 – Jan 31  → fall term (spans the calendar year boundary)
 *   Feb 1 – Jul 31  → spring term
 * Dates are returned as ISO yyyy-mm-dd strings (date-only, UTC) because the
 * admin-svc reports engine compares date columns, not timestamps.
 */

// Type alias (not interface) so the implicit index signature satisfies the
// reports engine's Record<string, unknown> params parameter.
export type ReportWindow = {
  startDate: string;
  endDate: string;
};

function isoDate(year: number, monthIndex: number, day: number): string {
  return new Date(Date.UTC(year, monthIndex, day)).toISOString().slice(0, 10);
}

/** The school term containing `now` (UTC), ending no later than today. */
export function currentTermWindow(now: Date = new Date()): ReportWindow {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth(); // 0-based
  const today = isoDate(year, month, now.getUTCDate());

  // Jan (month 0) belongs to the fall term that started the PREVIOUS Aug.
  if (month === 0) {
    return { startDate: isoDate(year - 1, 7, 1), endDate: today };
  }
  // Feb (1) … Jul (6) → spring term of the current year.
  if (month <= 6) {
    return { startDate: isoDate(year, 1, 1), endDate: today };
  }
  // Aug (7) … Dec (11) → fall term of the current year.
  return { startDate: isoDate(year, 7, 1), endDate: today };
}

/** Trailing N-day window ending today (UTC), for panels that want recency. */
export function lastNDaysWindow(now: Date = new Date(), days = 90): ReportWindow {
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const start = new Date(end - (days - 1) * 24 * 60 * 60 * 1000);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: new Date(end).toISOString().slice(0, 10),
  };
}
