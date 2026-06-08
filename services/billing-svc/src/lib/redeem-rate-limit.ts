/**
 * Durable, multi-replica-safe token bucket (Sprint 4 hardening).
 *
 * Replaces the process-local `Map` that previously guarded the coupon-redeem
 * endpoint — a per-process Map gives no protection once billing-svc runs more
 * than one replica (an attacker just spreads attempts across pods). This bucket
 * lives in Postgres (`billing_rate_limits`, one row per `(scope, subject)`
 * window), so the limit holds cluster-wide.
 *
 * The whole check-and-increment is a single atomic `INSERT … ON CONFLICT DO
 * UPDATE … RETURNING`, so concurrent requests can't race past the limit.
 */
import { sql } from "drizzle-orm";

export interface RateLimitResult {
  /** Whether this request is within the burst allowance. */
  allowed: boolean;
  /** The request count in the current window (after this attempt). */
  count: number;
}

export interface ConsumeOptions {
  /** Logical bucket, e.g. "coupon:redeem". */
  scope: string;
  /** Per-subject key, e.g. the caller's user id. */
  subject: string;
  /** Max requests allowed per window. */
  burst: number;
  /** Window length in seconds. */
  windowSeconds: number;
}

type Rows = { rows?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>;

/**
 * Atomically record one request and report whether it is within the allowance.
 * When the stored window has expired the counter resets to 1; otherwise it
 * increments. Returns `allowed=false` once the count exceeds `burst`.
 */
export async function consumeRateLimit(
  db: { execute: (q: ReturnType<typeof sql>) => Promise<unknown> },
  opts: ConsumeOptions,
): Promise<RateLimitResult> {
  const result = (await db.execute(sql`
    INSERT INTO billing_rate_limits AS rl (scope, subject, count, reset_at)
    VALUES (${opts.scope}, ${opts.subject}, 1, now() + make_interval(secs => ${opts.windowSeconds}))
    ON CONFLICT (scope, subject) DO UPDATE SET
      count = CASE WHEN rl.reset_at <= now() THEN 1 ELSE rl.count + 1 END,
      reset_at = CASE
        WHEN rl.reset_at <= now() THEN now() + make_interval(secs => ${opts.windowSeconds})
        ELSE rl.reset_at
      END
    RETURNING count
  `)) as Rows;
  const rows = Array.isArray(result) ? result : (result.rows ?? []);
  const count = Number(rows[0]?.count ?? 1);
  return { allowed: count <= opts.burst, count };
}
