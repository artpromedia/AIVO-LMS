/**
 * Offline outbox (Sprint 9).
 *
 * IndexedDB-backed queue for learner-side mutations that fail because
 * the network dropped mid-lesson. The queue is drained whenever the
 * browser fires the `online` event OR a consumer manually calls
 * `drainOutbox()`. Each enqueued request carries its Idempotency-Key
 * so the server (`lib/offline/idempotency.ts`) can short-circuit a
 * replayed request without double-mutating.
 *
 * Design notes:
 *
 *   - SSR-safe: every helper falls back to a no-op when `indexedDB` is
 *     undefined (Next.js server bundles, Vitest's default node env,
 *     pre-hydration paint).
 *   - No external dep — uses the native IndexedDB API behind a tiny
 *     Promise wrapper. Adding `idb` would be cleaner but adds a
 *     transitive package; the wrapper is ~30 lines.
 *   - Schema version 1 lives in `aivo-offline-outbox` DB, object
 *     store `outbox`. Records are keyed by `id` (caller-provided UUID).
 *
 * Out of scope for this sprint (tracked in ADR 0010):
 *   - Service-worker fetch interception (we just queue at the call
 *     site for now).
 *   - Server-driven conflict resolution on replay.
 */

export interface OutboxRecord {
  id: string;
  url: string;
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  /** JSON-serialisable body. Stored as a string to keep IDB happy. */
  body: string | null;
  /** Header subset we want to replay. The Idempotency-Key MUST be
   *  here so a replayed request is server-side deduped. */
  headers: Record<string, string>;
  /** ms epoch */
  enqueuedAt: number;
  /** ms epoch of the most recent drain attempt. */
  lastAttemptAt?: number;
  /** Number of drain attempts so far. */
  attempts: number;
  /** Optional caller label used for telemetry. */
  label?: string;
}

const DB_NAME = "aivo-offline-outbox";
const DB_VERSION = 1;
const STORE = "outbox";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("enqueuedAt", "enqueuedAt", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IDB open failed"));
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => Promise<T> | T,
): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    Promise.resolve(fn(store)).then(resolve, reject);
    tx.oncomplete = () => db.close();
    tx.onerror = () => reject(tx.error ?? new Error("IDB transaction failed"));
  });
}

function reqAsPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IDB request failed"));
  });
}

/** Add a record. No-op SSR-side. */
export async function enqueueOutbox(
  record: Omit<OutboxRecord, "enqueuedAt" | "attempts">,
): Promise<void> {
  if (!isBrowser()) return;
  const full: OutboxRecord = {
    ...record,
    enqueuedAt: Date.now(),
    attempts: 0,
  };
  await withStore("readwrite", (store) => reqAsPromise(store.put(full)));
}

export async function listOutbox(): Promise<OutboxRecord[]> {
  if (!isBrowser()) return [];
  return withStore("readonly", async (store) => {
    const all = await reqAsPromise(store.getAll());
    return (all as OutboxRecord[]).sort((a, b) => a.enqueuedAt - b.enqueuedAt);
  });
}

export async function removeOutbox(id: string): Promise<void> {
  if (!isBrowser()) return;
  await withStore("readwrite", (store) => reqAsPromise(store.delete(id)));
}

export async function clearOutbox(): Promise<void> {
  if (!isBrowser()) return;
  await withStore("readwrite", (store) => reqAsPromise(store.clear()));
}

export interface DrainResult {
  drained: number;
  failed: number;
  records: Array<{ id: string; ok: boolean; status?: number; error?: string }>;
}

/**
 * Replay every queued record in insertion order. Stops on the first
 * 5xx so transient downtime doesn't blow away the queue; 4xx responses
 * are treated as permanent failures (the server explicitly rejected
 * the request) and the record is removed.
 */
export async function drainOutbox(fetchImpl: typeof fetch = fetch): Promise<DrainResult> {
  if (!isBrowser()) return { drained: 0, failed: 0, records: [] };
  const records = await listOutbox();
  const result: DrainResult = { drained: 0, failed: 0, records: [] };

  for (const record of records) {
    try {
      const res = await fetchImpl(record.url, {
        method: record.method,
        headers: record.headers,
        body: record.body ?? undefined,
      });
      if (res.status >= 500) {
        // Transient — leave queued, stop draining.
        result.failed += 1;
        result.records.push({ id: record.id, ok: false, status: res.status });
        await bumpAttempts(record.id);
        break;
      }
      // 2xx / 3xx / 4xx — remove. 4xx is the server explicitly
      // refusing, retrying would do the same.
      await removeOutbox(record.id);
      result.drained += 1;
      result.records.push({ id: record.id, ok: res.ok, status: res.status });
    } catch (err) {
      // Network error — transient, leave queued, stop draining.
      result.failed += 1;
      result.records.push({
        id: record.id,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
      await bumpAttempts(record.id);
      break;
    }
  }
  return result;
}

async function bumpAttempts(id: string): Promise<void> {
  if (!isBrowser()) return;
  await withStore("readwrite", async (store) => {
    const rec = (await reqAsPromise(store.get(id))) as OutboxRecord | undefined;
    if (!rec) return;
    rec.attempts += 1;
    rec.lastAttemptAt = Date.now();
    await reqAsPromise(store.put(rec));
  });
}

/**
 * Install a global listener that drains the outbox whenever the
 * browser regains connectivity. Returns an unsubscribe function. Safe
 * to call from a top-level layout/provider.
 */
export function registerOutboxAutoDrain(): () => void {
  if (!isBrowser()) return () => {};
  const handler = () => {
    drainOutbox().catch(() => {
      /* swallow — drainOutbox already records failures per record. */
    });
  };
  window.addEventListener("online", handler);
  return () => window.removeEventListener("online", handler);
}

/**
 * Generate a stable client-side Idempotency-Key. Uses crypto.randomUUID
 * where available and falls back to a Date.now + Math.random combo for
 * older browsers (good enough for our cache-bound dedup).
 */
export function generateIdempotencyKey(prefix?: string): string {
  let uuid: string;
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    uuid = crypto.randomUUID();
  } else {
    uuid = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
  return prefix ? `${prefix}-${uuid}` : uuid;
}
