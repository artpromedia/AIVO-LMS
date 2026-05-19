/**
 * Sprint 23: lightweight in-memory token-bucket rate limit. Keyed by
 * `${userId}:${routeKey}`. Designed for the dev/preview environment — a real
 * deployment should swap this for a Redis-backed limiter.
 */
import { fail } from "@/lib/bff/response";
import { ERRORS } from "@/lib/bff/errors";
import type { NextResponse } from "next/server";
import type { BffFailure } from "@/lib/bff/response";

type Bucket = { tokens: number; updatedAt: number };

declare global {
  // `declare var` is required for global augmentation in TS; this is
  // expected pattern for module-scoped singletons.
  var __aivoRateBuckets: Map<string, Bucket> | undefined;
}

function buckets(): Map<string, Bucket> {
  if (!globalThis.__aivoRateBuckets) globalThis.__aivoRateBuckets = new Map();
  return globalThis.__aivoRateBuckets;
}

export type RateLimitOptions = {
  routeKey: string;
  /** Capacity of the bucket and refill cap. */
  burst: number;
  /** Tokens added per second. */
  refillPerSecond: number;
};

export function checkRateLimit(
  userId: string,
  opts: RateLimitOptions,
  requestId: string,
): NextResponse<BffFailure> | null {
  const key = `${userId}:${opts.routeKey}`;
  const now = Date.now();
  const b = buckets().get(key) ?? { tokens: opts.burst, updatedAt: now };
  const elapsedSec = Math.max(0, (now - b.updatedAt) / 1000);
  const refilled = Math.min(opts.burst, b.tokens + elapsedSec * opts.refillPerSecond);
  if (refilled < 1) {
    buckets().set(key, { tokens: refilled, updatedAt: now });
    return fail(
      {
        ...ERRORS.RATE_LIMITED,
        message: `Rate limit for ${opts.routeKey} exceeded`,
      },
      requestId,
    );
  }
  buckets().set(key, { tokens: refilled - 1, updatedAt: now });
  return null;
}

/**
 * Boolean variant for server actions and other non-Response call sites.
 * Returns true when a token was consumed, false when the bucket is empty.
 */
export function tryConsumeRateLimit(userId: string, opts: RateLimitOptions): boolean {
  const key = `${userId}:${opts.routeKey}`;
  const now = Date.now();
  const b = buckets().get(key) ?? { tokens: opts.burst, updatedAt: now };
  const elapsedSec = Math.max(0, (now - b.updatedAt) / 1000);
  const refilled = Math.min(opts.burst, b.tokens + elapsedSec * opts.refillPerSecond);
  if (refilled < 1) {
    buckets().set(key, { tokens: refilled, updatedAt: now });
    return false;
  }
  buckets().set(key, { tokens: refilled - 1, updatedAt: now });
  return true;
}

/** Convenience presets so call sites stay declarative. */
export const RATE_LIMITS = {
  // 10 generations/min sustained, allow brief bursts up to 12.
  AI_GENERATION: { burst: 12, refillPerSecond: 10 / 60 },
  // Cheap inspection routes still want a cap to deter abuse.
  WRITE_DEFAULT: { burst: 30, refillPerSecond: 30 / 60 },
} as const;
