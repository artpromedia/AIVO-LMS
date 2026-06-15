/**
 * Per-parent rate limit on starting NEW message threads.
 *
 * Replying to an existing thread is unconstrained; only thread creation is
 * capped so a parent (or a compromised session) cannot fan out a burst of new
 * conversations. Mirrors the in-memory approach of
 * `lib/collaboration/remind-rate-limit.ts` — sufficient for the single web pod;
 * comms-svc remains the durable store.
 */
const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_PER_WINDOW = 10; // new threads per parent per hour

type Bucket = number[]; // creation timestamps within the window
const buckets = new Map<string, Bucket>();

export type ComposeRateResult = { ok: true } | { ok: false; retryAfterSeconds: number };

function keyFor(tenantId: string, userId: string): string {
  return `${tenantId}:${userId}`;
}

/**
 * Check (and, on success, record) a new-thread creation. `now` is injectable
 * for tests.
 */
export function checkComposeRateLimit(
  tenantId: string,
  userId: string,
  now: number = Date.now(),
): ComposeRateResult {
  const key = keyFor(tenantId, userId);
  const recent = (buckets.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    buckets.set(key, recent);
    return { ok: false, retryAfterSeconds: Math.ceil((WINDOW_MS - (now - recent[0])) / 1000) };
  }
  recent.push(now);
  buckets.set(key, recent);
  return { ok: true };
}

/** Test seam. */
export function resetComposeRateLimitsForTest(): void {
  buckets.clear();
}
