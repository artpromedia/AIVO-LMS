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
  /**
   * Replay lane (Sprint A6). "session" items — a learner's session-end
   * progress — replay BEFORE "default" items so progress lands first when
   * connectivity returns. Within a lane, order is preserved.
   */
  priority?: "session" | "default";
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
  priority: "session" | "default" = "default",
): QueueItem {
  return {
    idempotencyKey: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
    action,
    baseUrl,
    path,
    method,
    body: body === undefined ? null : JSON.stringify(body),
    queuedAt: Date.now(),
    priority,
  };
}

/** Stable lane sort: every "session" item ahead of every "default" item. */
export function laneOrder(items: QueueItem[]): QueueItem[] {
  const session = items.filter((i) => i.priority === "session");
  const rest = items.filter((i) => i.priority !== "session");
  return [...session, ...rest];
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
  await migrateLegacySessionOutbox();
  const queue = laneOrder(dropStale(await loadQueue(), now));
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

// ── Legacy session-outbox migration (Sprint A6) ─────────────────────────────
// The stage screen used to keep its own AsyncStorage outbox under
// "@aivo/session_outbox" with a separate retry loop. Anything still queued
// there from a previous app version is folded into this queue (session
// lane) exactly once, so no child's progress is stranded by the upgrade.
const LEGACY_SESSION_OUTBOX_KEY = "@aivo/session_outbox";

interface LegacySessionEnd {
  sessionId: string;
  masteryUpdates: Record<string, number>;
  xpEarned: number;
  queuedAt: number;
}

export async function migrateLegacySessionOutbox(
  learningBaseUrl?: string,
): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(LEGACY_SESSION_OUTBOX_KEY);
    if (!raw) return 0;
    const legacy = JSON.parse(raw) as LegacySessionEnd[];
    if (!Array.isArray(legacy) || legacy.length === 0) {
      await AsyncStorage.removeItem(LEGACY_SESSION_OUTBOX_KEY);
      return 0;
    }
    const base =
      learningBaseUrl ?? (await import("@/constants/api")).API.LEARNING;
    const queue = await loadQueue();
    for (const entry of legacy) {
      if (!entry?.sessionId) continue;
      const item = makeItem(
        "session.complete",
        base,
        `/api/learning/sessions/${entry.sessionId}/complete`,
        "POST",
        { masteryUpdates: entry.masteryUpdates, xpEarned: entry.xpEarned },
        "session",
      );
      item.queuedAt = entry.queuedAt ?? Date.now();
      queue.push(item);
    }
    await saveQueue(queue);
    await AsyncStorage.removeItem(LEGACY_SESSION_OUTBOX_KEY);
    return legacy.length;
  } catch {
    return 0;
  }
}
