/**
 * Cross-platform SSE hook for React Native.
 *
 * React Native ships no `EventSource`, so we read the upstream response
 * body as a `ReadableStream` and parse the SSE wire format by hand. The
 * upstream is the platform service (learning-svc / comms-svc) reached
 * through the same base URL the JSON endpoints use; auth is the same
 * Bearer token the rest of the app carries.
 *
 * Lifecycle rules — match the web hook so behaviour is portable:
 *   - Open when the app is foreground AND a url is supplied.
 *   - Close on background and on cleanup.
 *   - Reconnect on error with exponential backoff (cap 30s) plus jitter.
 *   - Caller treats `state !== "open"` as the signal to keep its
 *     visibility/AppState-aware polling running. Polling is the
 *     documented fallback, not the primary path.
 */
import { useEffect, useRef, useState } from "react";
import { AppState, AppStateStatus } from "react-native";

export type SseState = "idle" | "connecting" | "open" | "closed";

export interface UseSseOptions {
  bearer?: string | null;
  onMessage?: (data: unknown, eventName: string) => void;
  enabled?: boolean;
  maxBackoffMs?: number;
  /** Default subject if the upstream emits unnamed `data:` lines. */
  defaultEventName?: string;
}

export interface UseSseResult {
  state: SseState;
  lastEventAt: number | null;
  lastError: string | null;
}

interface ParsedFrame {
  event: string;
  data: string;
}

function* parseFrames(buffer: { value: string }, defaultEvent: string): Generator<ParsedFrame> {
  // SSE frames are separated by a blank line. Each frame is one or more
  // "field: value" lines.
  let idx: number;
  while ((idx = buffer.value.indexOf("\n\n")) !== -1) {
    const raw = buffer.value.slice(0, idx);
    buffer.value = buffer.value.slice(idx + 2);
    let event = defaultEvent;
    const dataLines: string[] = [];
    for (const line of raw.split("\n")) {
      if (line.startsWith(":")) continue; // comment / heartbeat
      const colon = line.indexOf(":");
      if (colon === -1) continue;
      const field = line.slice(0, colon);
      const value = line.slice(colon + 1).replace(/^ /, "");
      if (field === "event") event = value;
      else if (field === "data") dataLines.push(value);
    }
    if (dataLines.length > 0) {
      yield { event, data: dataLines.join("\n") };
    }
  }
}

export function useSse(url: string | null, options: UseSseOptions = {}): UseSseResult {
  const {
    bearer = null,
    onMessage,
    enabled = true,
    maxBackoffMs = 30_000,
    defaultEventName = "message",
  } = options;

  const [state, setState] = useState<SseState>("idle");
  const [lastEventAt, setLastEventAt] = useState<number | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!enabled || !url) {
      setState("idle");
      return undefined;
    }

    let abort = new AbortController();
    let timer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    let cancelled = false;
    let foreground = AppState.currentState === "active";

    const parse = (raw: string): unknown => {
      try {
        return JSON.parse(raw);
      } catch {
        return raw;
      }
    };

    async function pump() {
      if (cancelled || !foreground) return;
      setState("connecting");
      abort = new AbortController();
      try {
        const res = await fetch(url!, {
          method: "GET",
          headers: {
            accept: "text/event-stream",
            ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
          },
          signal: abort.signal,
        });
        if (!res.ok || !res.body) {
          throw new Error(`upstream ${res.status}`);
        }
        attempt = 0;
        setState("open");
        setLastError(null);
        // React Native's fetch returns a ReadableStream (Hermes + RN 0.72+).
        const reader = (res.body as unknown as ReadableStream<Uint8Array>).getReader();
        const decoder = new TextDecoder();
        const buffer = { value: "" };
        while (!cancelled) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer.value += decoder.decode(value, { stream: true });
          for (const frame of parseFrames(buffer, defaultEventName)) {
            setLastEventAt(Date.now());
            onMessageRef.current?.(parse(frame.data), frame.event);
          }
        }
        // Stream ended cleanly — treat like an error so we reconnect (the
        // upstream is supposed to be long-lived).
        throw new Error("stream ended");
      } catch (err) {
        if (cancelled) return;
        setLastError(err instanceof Error ? err.message : "stream error");
        setState("closed");
        const delay = Math.min(maxBackoffMs, 500 * 2 ** attempt) + Math.floor(Math.random() * 250);
        attempt += 1;
        timer = setTimeout(pump, delay);
      }
    }

    const handleAppState = (next: AppStateStatus) => {
      const nowForeground = next === "active";
      if (nowForeground === foreground) return;
      foreground = nowForeground;
      if (foreground) {
        attempt = 0;
        pump();
      } else {
        if (timer) clearTimeout(timer);
        abort.abort();
        setState("closed");
      }
    };
    const sub = AppState.addEventListener("change", handleAppState);

    pump();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      try {
        abort.abort();
      } catch {
        /* ignore */
      }
      sub.remove();
      setState("closed");
    };
  }, [url, enabled, bearer, maxBackoffMs, defaultEventName]);

  return { state, lastEventAt, lastError };
}
