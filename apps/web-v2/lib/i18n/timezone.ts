/**
 * Viewer-timezone resolution (Sprint A8).
 *
 * Chain: the user's stored IANA zone (set explicitly in settings, or
 * auto-detected once by tz-sync) → UTC. The previous behavior hardcoded
 * America/New_York for every user on the planet.
 */
export const FALLBACK_TIME_ZONE = "UTC";

export function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function resolveTimeZone(
  userTimeZone: string | null | undefined,
  tenantTimeZone?: string | null,
): string {
  if (isValidTimeZone(userTimeZone)) return userTimeZone;
  if (isValidTimeZone(tenantTimeZone)) return tenantTimeZone;
  return FALLBACK_TIME_ZONE;
}
