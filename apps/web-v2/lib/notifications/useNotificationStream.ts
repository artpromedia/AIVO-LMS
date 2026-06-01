"use client";

/**
 * Notification stream client hook.
 *
 * Real-time notifications without a websocket dependency: the hook
 * subscribes to an SSE endpoint when available and falls back to a
 * short-interval poll. Either way, consumers see a single,
 * subscription-style interface (`{ notifications, lastUpdatedAt,
 * markRead, refresh }`).
 *
 * Pass `sseUrl` (e.g. `/api/bff/notifications/stream`) to opt in to
 * server-pushed updates; omit it to run on the polling fallback only.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
  /**
   * Phase 3 — ADR 0020 cross-role data & navigation.
   *
   * Role the recipient must be in to act on this notification. When
   * present and different from `activeRole`, the inbox renders a
   * role chip on the row and the tap handler routes through
   * `/role-switch?to=<role>&next=<href>&reason=notification` before
   * navigating. Optional during rollout — older notifications without
   * a `targetRole` fall back to the active role.
   */
  targetRole?:
    | "learner"
    | "parent"
    | "teacher"
    | "therapist"
    | "caregiver"
    | "schoolAdmin"
    | "districtAdmin"
    | "internal"
    | null;
  /** Optional href the row links to. */
  href?: string | null;
  /** Optional learner this notification refers to. */
  targetLearnerId?: string | null;
}

export interface UseNotificationStreamOptions {
  /** GET endpoint that returns the full list. Used for initial load
   *  + the polling fallback. */
  fetchUrl: string;
  /** Optional SSE endpoint pushing `{ type: "notification", item }`
   *  events. When omitted, the hook polls. */
  sseUrl?: string;
  /** Polling fallback interval. Default 30 s. */
  pollIntervalMs?: number;
  /** Mark-as-read endpoint, called as POST with `{ id }`. Optional —
   *  when omitted, `markRead` is a no-op that still updates local state. */
  markReadUrl?: string;
}

export interface UseNotificationStreamResult {
  notifications: NotificationItem[];
  /** ms epoch of the last successful refresh. */
  lastUpdatedAt: number;
  /** Total count of unread notifications. */
  unreadCount: number;
  /** Mark a single notification as read both locally and (if wired) on the server. */
  markRead: (id: string) => Promise<void>;
  /** Force a refresh — useful for the "Refresh" button. */
  refresh: () => Promise<void>;
  /** Last error message, if any (kept for the UI's diagnostic strip). */
  lastError: string | null;
}

function parseList(payload: unknown): NotificationItem[] {
  if (Array.isArray(payload)) return payload as NotificationItem[];
  if (
    payload !== null &&
    typeof payload === "object" &&
    Array.isArray((payload as { data?: unknown }).data)
  ) {
    return (payload as { data: NotificationItem[] }).data;
  }
  return [];
}

export function useNotificationStream(
  options: UseNotificationStreamOptions,
): UseNotificationStreamResult {
  const { fetchUrl, sseUrl, pollIntervalMs = 30_000, markReadUrl } = options;
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number>(0);
  const [lastError, setLastError] = useState<string | null>(null);
  const fetchInFlightRef = useRef(false);

  const refresh = useCallback(async () => {
    if (fetchInFlightRef.current) return;
    fetchInFlightRef.current = true;
    try {
      const res = await fetch(fetchUrl, { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = await res.json();
      setNotifications(parseList(payload));
      setLastUpdatedAt(Date.now());
      setLastError(null);
    } catch (err) {
      setLastError(err instanceof Error ? err.message : String(err));
    } finally {
      fetchInFlightRef.current = false;
    }
  }, [fetchUrl]);

  // Initial load + polling fallback.
  useEffect(() => {
    refresh();
    if (sseUrl) return undefined; // SSE branch owns its own refresh cadence.
    const interval = setInterval(refresh, pollIntervalMs);
    return () => clearInterval(interval);
  }, [refresh, sseUrl, pollIntervalMs]);

  // SSE subscription — auto-falls-back to polling on connection failure.
  useEffect(() => {
    if (!sseUrl || typeof EventSource === "undefined") return undefined;
    let es: EventSource;
    let pollInterval: ReturnType<typeof setInterval> | undefined;
    try {
      es = new EventSource(sseUrl, { withCredentials: true });
      es.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed?.type === "notification" && parsed.item) {
            const incoming = parsed.item as NotificationItem;
            setNotifications((prev) => {
              if (prev.some((n) => n.id === incoming.id)) return prev;
              return [incoming, ...prev];
            });
            setLastUpdatedAt(Date.now());
          } else if (parsed?.type === "refresh") {
            refresh();
          }
        } catch {
          // ignore malformed SSE payloads — the next event will retry.
        }
      };
      es.onerror = () => {
        // SSE dropped: close + start polling.
        es?.close();
        if (!pollInterval) pollInterval = setInterval(refresh, pollIntervalMs);
      };
    } catch (err) {
      setLastError(err instanceof Error ? err.message : "SSE init failed");
      pollInterval = setInterval(refresh, pollIntervalMs);
    }
    return () => {
      es?.close();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [sseUrl, refresh, pollIntervalMs]);

  const markRead = useCallback<UseNotificationStreamResult["markRead"]>(
    async (id) => {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)),
      );
      if (!markReadUrl) return;
      try {
        await fetch(markReadUrl, {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id }),
        });
      } catch {
        // Local state already updated; server will reconcile on next refresh.
      }
    },
    [markReadUrl],
  );

  const unreadCount = useMemo(
    () => notifications.reduce((acc, n) => acc + (n.readAt ? 0 : 1), 0),
    [notifications],
  );

  return { notifications, lastUpdatedAt, unreadCount, markRead, refresh, lastError };
}
