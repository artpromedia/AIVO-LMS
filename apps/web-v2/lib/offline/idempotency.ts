import { and, eq } from "drizzle-orm";
import { idempotencyKeys } from "@aivo/db";
import { serverEnv } from "@/lib/env";
import { getDb } from "@/lib/db/persistence/drizzle/client";

const MAX_KEYS = 5_000;
const KEY_TTL_MS = 10 * 60 * 1000;

type CacheEntry = {
  body: unknown;
  status: number;
  cachedAt: number;
};

const cache = new Map<string, CacheEntry>();

function cacheKey(tenantId: string, route: string, idempotencyKey: string): string {
  return `${tenantId}|${route}|${idempotencyKey}`;
}

function usesDurableStore(): boolean {
  return (
    serverEnv.NODE_ENV === "production" ||
    serverEnv.AIVO_PERSISTENCE === "postgres" ||
    serverEnv.AIVO_PERSISTENCE_LESSON_RUNS === "postgres"
  );
}

function evictExpired(): void {
  if (cache.size <= MAX_KEYS) return;
  const cutoff = Date.now() - KEY_TTL_MS;
  for (const [key, value] of cache) {
    if (value.cachedAt < cutoff || cache.size > MAX_KEYS) {
      cache.delete(key);
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

function readMemory(
  tenantId: string,
  route: string,
  idempotencyKey: string,
): IdempotencyCacheEntry | null {
  const key = cacheKey(tenantId, route, idempotencyKey);
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > KEY_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return { body: entry.body, status: entry.status };
}

export async function readIdempotencyCache(
  tenantId: string,
  route: string,
  idempotencyKey: string,
): Promise<IdempotencyCacheEntry | null> {
  if (!usesDurableStore()) return readMemory(tenantId, route, idempotencyKey);

  const db = getDb();
  const [row] = await db
    .select()
    .from(idempotencyKeys)
    .where(
      and(
        eq(idempotencyKeys.tenantId, tenantId),
        eq(idempotencyKeys.route, route),
        eq(idempotencyKeys.idempotencyKey, idempotencyKey),
      ),
    )
    .limit(1);
  if (!row) return null;
  if (row.expiresAt.getTime() <= Date.now()) {
    await db
      .delete(idempotencyKeys)
      .where(
        and(
          eq(idempotencyKeys.tenantId, tenantId),
          eq(idempotencyKeys.route, route),
          eq(idempotencyKeys.idempotencyKey, idempotencyKey),
        ),
      );
    return null;
  }
  return { body: row.responseBody, status: row.responseStatus };
}

export async function writeIdempotencyCache(
  tenantId: string,
  route: string,
  idempotencyKey: string,
  body: unknown,
  status: number,
): Promise<void> {
  if (usesDurableStore()) {
    const now = new Date();
    await getDb()
      .insert(idempotencyKeys)
      .values({
        tenantId,
        route,
        idempotencyKey,
        responseBody: body,
        responseStatus: status,
        createdAt: now,
        expiresAt: new Date(now.getTime() + KEY_TTL_MS),
      })
      .onConflictDoUpdate({
        target: [idempotencyKeys.tenantId, idempotencyKeys.route, idempotencyKeys.idempotencyKey],
        set: {
          responseBody: body,
          responseStatus: status,
          createdAt: now,
          expiresAt: new Date(now.getTime() + KEY_TTL_MS),
        },
      });
    return;
  }

  const key = cacheKey(tenantId, route, idempotencyKey);
  cache.set(key, { body, status, cachedAt: Date.now() });
  evictExpired();
}

export function readIdempotencyKey(req: Request): string | null {
  const raw = req.headers.get("idempotency-key") ?? req.headers.get("Idempotency-Key") ?? null;
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed.length < 8 || trimmed.length > 128) return null;
  // eslint-disable-next-line no-control-regex -- intentional input validation.
  if (/[\x00-\x1f|]/.test(trimmed)) return null;
  return trimmed;
}

export function __resetIdempotencyCacheForTests(): void {
  cache.clear();
}
