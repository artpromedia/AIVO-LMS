/**
 * Sprint C-08 — per-member manual "Remind" rate limit.
 *
 * The team hub lets a parent re-send an invite with one tap. To keep the
 * teammate's inbox kind (and to match the persona bar — "the contributor must
 * never get a nagging email tone"), a manual remind for a given invite is
 * allowed at most once per cooldown window. This is independent of the
 * automatic contribution-nudge job's 7-day ledger cap (that runs server-side
 * in comms-svc); this guard governs the human-triggered button.
 *
 * In-memory is sufficient for the single-pod web tier (the same trade-off
 * family-svc makes for its invite rate limiter). Keyed by (tenant, invite).
 */
const COOLDOWN_MS = 60 * 60 * 1000; // 1 hour between manual reminders.

type Stamp = { lastAt: number };
const buckets = new Map<string, Stamp>();

export type RemindRateResult =
  | { ok: true }
  | { ok: false; retryAfterSeconds: number };

function keyFor(tenantId: string, inviteId: string): string {
  return `${tenantId}:${inviteId}`;
}

/**
 * Check (and, on success, record) a manual remind for an invite. Returns
 * `retryAfterSeconds` when the caller must wait. `now` is injectable for tests.
 */
export function checkRemindRateLimit(
  tenantId: string,
  inviteId: string,
  now: number = Date.now(),
): RemindRateResult {
  const key = keyFor(tenantId, inviteId);
  const prev = buckets.get(key);
  if (prev && now - prev.lastAt < COOLDOWN_MS) {
    return { ok: false, retryAfterSeconds: Math.ceil((COOLDOWN_MS - (now - prev.lastAt)) / 1000) };
  }
  buckets.set(key, { lastAt: now });
  return { ok: true };
}

/** Test seam: clear all recorded reminders. */
export function resetRemindRateLimitsForTest(): void {
  buckets.clear();
}
