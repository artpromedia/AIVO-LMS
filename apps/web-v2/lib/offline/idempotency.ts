/**
 * Idempotency-key dedup helper (Sprint 9).
 *
 * The offline outbox replays mutating BFF calls after the network
 * recovers. A naive replay would double-record a lesson step if the
 * original request reached the server before the client crashed (a
 * common offline failure mode). To make replay safe, each mutating
 * call carries an `Idempotency-Key` header — a stable client-generated
 * UUID per logical action. The server remembers the most recent N
 * keys and short-circuits any replay with a previously-seen key,
 * returning the cached response.
 *
 * This module is the in-process store. It is deliberately small (an
 * LRU bounded at MAX_KEYS) so it works with the existing
 * apps/web-v2/lib/db/store.ts in-memory BFF. When the BFF migrates to
 * Postgres, swap the Map for a row in an `idempotency_keys` table —
 * the contract from the route's point of view is unchanged.
 */

const MAX_KEYS = 5_000;
const KEY_TTL_MS = 10 * 60 * 1000; // 10 minutes

type CacheEntry = {
  /** Cached JSON-serialisable response body. */
  body: unknown;
  /** HTTP status code returned the first time. */
  status: number;
  /** ms epoch when the entry was created. */
  cachedAt: number;
};

/** Per-(tenant, route, key) cache. The composite key prevents a
 *  tenant-A client from being served a tenant-B response if both ever
 *  picked the same UUID (vanishingly unlikely, but cheap to guarantee). */
const cache = new Map<string, CacheEntry>();

function cacheKey(tenantId: string, route: string, idempotencyKey: string): string {
  return `${tenantId}|${route}|${idempotencyKey}`;
}

function evictExpired(): void {
  if (cache.size <= MAX_KEYS) return;
  const cutoff = Date.now() - KEY_TTL_MS;
  // Map iteration is insertion-order, so the oldest entries come first.
  for (const [k, v] of cache) {
    if (v.cachedAt < cutoff || cache.size > MAX_KEYS) {
      cache.delete(k);
      if (cache.size <= MAX_KEYS * 0.9) break;
    } else {
      break;
    }
  }
}

export interface IdempotencyCacheEntry {
  body: unknown;
  status: number;
}

/** Read a previously cached response for the given key. */
export function readIdempotencyCache(
  tenantId: string,
  route: string,
  idempotencyKey: string,
): IdempotencyCacheEntry | null {
  const k = cacheKey(tenantId, route, idempotencyKey);
  const entry = cache.get(k);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > KEY_TTL_MS) {
    cache.delete(k);
    return null;
  }
  return { body: entry.body, status: entry.status };
}

/** Cache the response body for a (tenant, route, key) triple. */
export function writeIdempotencyCache(
  tenantId: string,
  route: string,
  idempotencyKey: string,
  body: unknown,
  status: number,
): void {
  const k = cacheKey(tenantId, route, idempotencyKey);
  cache.set(k, { body, status, cachedAt: Date.now() });
  evictExpired();
}

/**
 * Extract the Idempotency-Key header from a request. Returns null if
 * missing or malformed. We accept lower- and upper-case header names
 * (Next.js normalises to lower, but tests may pass either).
 */
export function readIdempotencyKey(req: Request): string | null {
  const raw = req.headers.get("idempotency-key") ?? req.headers.get("Idempotency-Key") ?? null;
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed.length < 8 || trimmed.length > 128) return null;
  // Permissive: accept UUIDs, ULIDs, nanoid-ish slugs. Reject control
  // chars and pipe (our composite-key separator).
  // eslint-disable-next-line no-control-regex -- intentional: rejecting control chars is the whole point.
  if (/[\x00-\x1f|]/.test(trimmed)) return null;
  return trimmed;
}

/** Clear the cache — test-only helper, not exported from index. */
export function __resetIdempotencyCacheForTests(): void {
  cache.clear();
}
