"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Generic, reconnecting Server-Sent Events hook.
 *
 * Wraps the browser's `EventSource` with the boring-but-essential bits the
 * raw API lacks: exponential backoff on disconnect (capped at 30s), reset on
 * successful open, document-visibility pause so a backgrounded tab doesn't
 * pin the upstream, and a `state` flag callers can use to fall back to
 * polling when the stream is unhealthy.
 *
 * Polling is the documented fallback: when `state !== "open"` for more than
 * one tick, the caller should keep its existing visibility-aware
 * `setInterval` running. Sse is a latency optimization, not the source of
 * truth — the JSON GET endpoint is.
 *
 * Usage:
 *   const { state, lastEventAt } = useSse(url, {
 *     onMessage: (data) => mergeIncoming(data),
 *     enabled: !!url,
 *   });
 */
export type SseState = "idle" | "connecting" | "open" | "closed";

export interface UseSseOptions {
  /** Called for every message event (already JSON-parsed when possible). */
  onMessage?: (data: unknown, raw: MessageEvent) => void;
  /** Called for named events (e.g. "message", "session"). */
  onNamedEvent?: (name: string, data: unknown, raw: MessageEvent) => void;
  /** Allow the caller to gate the connection (e.g. when no thread is open). */
  enabled?: boolean;
  /** Send credentials (cookies) with the EventSource — defaults to true. */
  withCredentials?: boolean;
  /** Override the maximum backoff delay between reconnect attempts. */
  maxBackoffMs?: number;
}

export interface UseSseResult {
  state: SseState;
  lastEventAt: number | null;
  lastError: string | null;
}

const NAMED_EVENTS = ["message", "session", "notification"] as const;

export function useSse(url: string | null, options: UseSseOptions = {}): UseSseResult {
  const {
    onMessage,
    onNamedEvent,
    enabled = true,
    withCredentials = true,
    maxBackoffMs = 30_000,
  } = options;

  const [state, setState] = useState<SseState>("idle");
  const [lastEventAt, setLastEventAt] = useState<number | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  // Keep latest handlers in refs so we don't tear down/rebuild the
  // EventSource on every render.
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  const onNamedRef = useRef(onNamedEvent);
  onNamedRef.current = onNamedEvent;

  useEffect(() => {
    if (!enabled || !url || typeof window === "undefined" || typeof EventSource === "undefined") {
      setState("idle");
      return undefined;
    }

    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    let cancelled = false;

    const visibilityListener = () => {
      // Browsers freeze EventSource in background tabs. When we come back
      // foreground and the socket is closed, reconnect immediately.
      if (document.visibilityState === "visible" && es?.readyState === EventSource.CLOSED) {
        attempt = 0;
        connect();
      }
    };

    const parse = (raw: string): unknown => {
      try {
        return JSON.parse(raw);
      } catch {
        return raw;
      }
    };

    function connect() {
      if (cancelled) return;
      // Don't open a new socket while the tab is hidden — saves the upstream
      // a connection it won't read.
      if (document.visibilityState !== "visible") {
        setState("idle");
        return;
      }
      setState("connecting");
      try {
        es = new EventSource(url!, { withCredentials });
      } catch (err) {
        setLastError(err instanceof Error ? err.message : "EventSource init failed");
        scheduleReconnect();
        return;
      }
      es.onopen = () => {
        attempt = 0;
        setState("open");
        setLastError(null);
      };
      es.onmessage = (event) => {
        setLastEventAt(Date.now());
        const data = parse(event.data);
        onMessageRef.current?.(data, event);
      };
      for (const name of NAMED_EVENTS) {
        es.addEventListener(name, (event) => {
          const me = event as MessageEvent;
          setLastEventAt(Date.now());
          const data = parse(me.data);
          onNamedRef.current?.(name, data, me);
        });
      }
      es.onerror = () => {
        setState("closed");
        setLastError("stream error");
        es?.close();
        es = null;
        scheduleReconnect();
      };
    }

    function scheduleReconnect() {
      if (cancelled) return;
      const delay = Math.min(maxBackoffMs, 500 * 2 ** attempt) + Math.floor(Math.random() * 250);
      attempt += 1;
      reconnectTimer = setTimeout(connect, delay);
    }

    document.addEventListener("visibilitychange", visibilityListener);
    connect();

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", visibilityListener);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      es?.close();
      es = null;
      setState("closed");
    };
  }, [url, enabled, withCredentials, maxBackoffMs]);

  return { state, lastEventAt, lastError };
}
