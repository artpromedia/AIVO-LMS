/**
 * Pure scheduling logic for human coach/therapist sessions.
 *
 * Kept side-effect-free and timezone-injectable so booking validation is
 * deterministic and unit-tested. The repo layer composes these with access
 * control + persistence.
 */
import type { Provider, CoachingSession } from "@/lib/db/types";

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/** Local weekday + time-of-day for an instant in `timeZone`. */
export function localDayTime(
  iso: string,
  timeZone: string,
): { dayOfWeek: number; hour: number; minute: number } {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0") % 24;
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return { dayOfWeek: WEEKDAY_INDEX[weekday] ?? 0, hour, minute };
}

/**
 * True when [start, start+duration) fits entirely inside one of the provider's
 * weekly availability windows (evaluated in the provider's timezone).
 */
export function isWithinAvailability(
  provider: Provider,
  startIso: string,
  durationMinutes: number,
): boolean {
  if (durationMinutes <= 0) return false;
  const { dayOfWeek, hour, minute } = localDayTime(startIso, provider.timezone);
  const startMins = hour * 60 + minute;
  const endMins = startMins + durationMinutes;
  return provider.availability.some(
    (w) => w.dayOfWeek === dayOfWeek && startMins >= w.startHour * 60 && endMins <= w.endHour * 60,
  );
}

/**
 * True when the candidate slot overlaps an existing *scheduled* session for the
 * same provider. `ignoreSessionId` excludes the session being rescheduled.
 */
export function hasConflict(
  existing: CoachingSession[],
  providerId: string,
  startIso: string,
  durationMinutes: number,
  ignoreSessionId?: string,
): boolean {
  const start = new Date(startIso).getTime();
  const end = start + durationMinutes * 60_000;
  return existing.some((s) => {
    if (s.providerId !== providerId || s.status !== "scheduled") return false;
    if (ignoreSessionId && s.id === ignoreSessionId) return false;
    const sStart = new Date(s.scheduledStart).getTime();
    const sEnd = sStart + s.durationMinutes * 60_000;
    return start < sEnd && sStart < end; // half-open overlap
  });
}

/** A start instant is bookable only in the future. */
export function isFuture(startIso: string, now: number = Date.now()): boolean {
  const t = new Date(startIso).getTime();
  return !Number.isNaN(t) && t > now;
}
