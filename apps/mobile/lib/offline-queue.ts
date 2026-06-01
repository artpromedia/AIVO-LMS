/**
 * Persistent, authenticated offline action queue.
 *
 * Replaces the previous in-memory array (which lost everything on app
 * restart and replayed requests with no auth header). Per the unified-app
 * contract this queue:
 *
 *   - persists to durable storage (AsyncStorage) so it survives restarts,
 *   - stamps each item with an `idempotencyKey` so the server can dedupe a
 *     replay with a 200 no-op,
 *   - replays through `apiFetch`, which attaches the bearer token and does
 *     the single silent-refresh retry, so replayed writes are authenticated,
 *   - drops items older than 7 days on flush (stale), and
 *   - flushes in order, stopping on the first network/5xx failure so a
 *     transient outage doesn't reorder or drop pending writes.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiFetch } from "./api";

const STORAGE_KEY = "aivo_offline_queue";
export const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface QueueItem {
  idempotencyKey: string;
  action: string;
  /** Service base URL (e.g. `API.LEARNING`). */
  baseUrl: string;
  /** Path appended to baseUrl (e.g. `/api/learning/sessions/123/answer`). */
  path: string;
  method: string;
  /** JSON-encoded body, or null for bodyless requests. */
  body: string | null;
  queuedAt: number;
}

export function makeItem(
  action: string,
  baseUrl: string,
  path: string,
  method: string,
  body: unknown,
): QueueItem {
  return {
    idempotencyKey: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
    action,
    baseUrl,
    path,
    method,
    body: body === undefined ? null : JSON.stringify(body),
    queuedAt: Date.now(),
  };
}

export async function loadQueue(): Promise<QueueItem[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as QueueItem[]) : [];
  } catch {
    return [];
  }
}

export async function saveQueue(items: QueueItem[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Best-effort; a failed persist just means the item retries from memory.
  }
}

/** Drop items older than {@link MAX_AGE_MS}. */
export function dropStale(items: QueueItem[], now: number = Date.now()): QueueItem[] {
  const cutoff = now - MAX_AGE_MS;
  return items.filter((i) => i.queuedAt >= cutoff);
}

/** Append an item and persist. Returns the new queue length. */
export async function enqueue(item: QueueItem): Promise<number> {
  const queue = await loadQueue();
  queue.push(item);
  await saveQueue(queue);
  return queue.length;
}

/**
 * Replay the queue in order. An item is consumed on any non-5xx response
 * (2xx success, or a 4xx the server won't ever accept — including the 200
 * idempotency no-op). A 5xx or network error stops the flush and the
 * remaining items (including the failed one) are kept for the next attempt.
 * Returns the number of items still pending.
 */
export async function flushQueue(now: number = Date.now()): Promise<number> {
  const queue = dropStale(await loadQueue(), now);
  const remaining: QueueItem[] = [];
  let stop = false;

  for (const item of queue) {
    if (stop) {
      remaining.push(item);
      continue;
    }
    try {
      const res = await apiFetch(item.baseUrl, item.path, {
        method: item.method,
        body: item.body ?? undefined,
        headers: { "Idempotency-Key": item.idempotencyKey },
      });
      if (res.status >= 500) {
        stop = true;
        remaining.push(item);
      }
      // non-5xx → consumed (drop).
    } catch {
      stop = true;
      remaining.push(item);
    }
  }

  await saveQueue(remaining);
  return remaining.length;
}

export async function queueLength(): Promise<number> {
  return (await loadQueue()).length;
}
