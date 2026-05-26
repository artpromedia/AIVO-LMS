/**
 * Sprint 12.7 — LTI 1.3 JWKS cache.
 *
 * Per IMS Global the platform's JWKS endpoint is the source of truth
 * for the keys it signs id_tokens with. We cache the raw JSON by URL
 * with a TTL (default 10 minutes), and honour the upstream ETag /
 * Last-Modified to refresh efficiently.
 *
 * The cache is in-process and intentionally simple — Canvas, Schoology,
 * and Moodle all rotate their keys infrequently, so the worst case on
 * a cold cache is one extra fetch per platform per process start.
 */

import * as jose from "jose";

interface CacheEntry {
  fetchedAt: number;
  expiresAt: number;
  etag?: string;
  lastModified?: string;
  keySet: ReturnType<typeof jose.createLocalJWKSet>;
  rawKeys: any[];
}

const DEFAULT_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

export interface JwksCacheOptions {
  ttlMs?: number;
}

export async function getRemoteJwks(
  url: string,
  options: JwksCacheOptions = {},
): Promise<ReturnType<typeof jose.createLocalJWKSet>> {
  const ttl = options.ttlMs ?? DEFAULT_TTL_MS;
  const now = Date.now();
  const existing = cache.get(url);
  if (existing && existing.expiresAt > now) {
    return existing.keySet;
  }
  const headers: Record<string, string> = { accept: "application/json" };
  if (existing?.etag) headers["if-none-match"] = existing.etag;
  if (existing?.lastModified) headers["if-modified-since"] = existing.lastModified;
  const res = await fetch(url, { headers });
  if (res.status === 304 && existing) {
    existing.expiresAt = now + ttl;
    cache.set(url, existing);
    return existing.keySet;
  }
  if (!res.ok) {
    throw new Error(`JWKS fetch failed for ${url}: HTTP ${res.status}`);
  }
  const body = (await res.json()) as { keys: any[] };
  const keySet = jose.createLocalJWKSet(body);
  const entry: CacheEntry = {
    fetchedAt: now,
    expiresAt: now + ttl,
    etag: res.headers.get("etag") ?? undefined,
    lastModified: res.headers.get("last-modified") ?? undefined,
    keySet,
    rawKeys: body.keys,
  };
  cache.set(url, entry);
  return keySet;
}

/** Test-only — drop a cached JWKS entry. */
export function _resetJwksCache(url?: string): void {
  if (url) cache.delete(url);
  else cache.clear();
}
