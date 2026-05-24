"use client";

/**
 * Sprint 1.3 — debounced surface telemetry buffer.
 *
 * The lesson player and surface host emit a stream of impression /
 * interaction / completion / abandon events. We want:
 *
 *   1. A short coalesce window (default 5s) so a rapid burst of
 *      sub-events (e.g. ink strokes, focus changes) ships as one
 *      batch instead of one POST per event.
 *   2. Best-effort durability — if the network is down or the BFF
 *      returns 5xx, the batch is enqueued for retry. The PWA service
 *      worker carries the payload across reload/offline using
 *      `localStorage` as a fallback when Background Sync isn't
 *      available.
 *   3. A `flush()` for "the page is about to close" — call this from
 *      a beforeunload / visibilitychange=hidden handler so in-flight
 *      events don't disappear when the learner closes the tab.
 *
 * The buffer keeps events in memory (and `localStorage`) — no Zustand
 * or external store — so it can be used from any component without
 * pulling a state-management library into the lesson player route.
 */
import type { SurfaceTelemetryEventType } from "@aivo/learner-surfaces";

export interface BufferedTelemetryEvent {
  learnerId: string;
  sessionId?: string;
  /**
   * `learner-surfaces` event types (`surface_started`, `ink_completed`,
   * etc) plus four high-level player events used to satisfy Sprint 1.3:
   * impression / interaction / completion / abandon.
   */
  eventType:
    | SurfaceTelemetryEventType
    | "impression"
    | "interaction"
    | "completion"
    | "abandon";
  payload?: Record<string, unknown>;
  /** ISO-8601 — set automatically when enqueued. */
  enqueuedAt: string;
  /** Number of unsuccessful flush attempts so far. */
  attempts: number;
}

const STORAGE_KEY = "aivo.telemetry.buffer.v1";
const DEFAULT_DEBOUNCE_MS = 5_000;
const MAX_ATTEMPTS = 6;
const BACKOFF_BASE_MS = 2_000;

interface BufferOptions {
  endpoint?: string;
  debounceMs?: number;
  maxBatchSize?: number;
  fetchImpl?: typeof fetch;
}

class TelemetryBuffer {
  private queue: BufferedTelemetryEvent[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private flushing = false;
  private endpoint: string;
  private debounceMs: number;
  private maxBatchSize: number;
  private fetchImpl: typeof fetch;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(opts: BufferOptions = {}) {
    this.endpoint = opts.endpoint ?? "/api/bff/learning/surface-telemetry";
    this.debounceMs = opts.debounceMs ?? DEFAULT_DEBOUNCE_MS;
    this.maxBatchSize = opts.maxBatchSize ?? 50;
    this.fetchImpl = opts.fetchImpl ?? (typeof fetch !== "undefined" ? fetch.bind(globalThis) : (async () => new Response(null, { status: 599 })) as typeof fetch);
    this.hydrate();
    this.attachLifecycleListeners();
  }

  enqueue(event: Omit<BufferedTelemetryEvent, "enqueuedAt" | "attempts">) {
    const full: BufferedTelemetryEvent = {
      ...event,
      enqueuedAt: new Date().toISOString(),
      attempts: 0,
    };
    this.queue.push(full);
    this.persist();
    this.scheduleFlush();
  }

  /**
   * Flush immediately. Returns true if every queued event was sent or
   * dropped after exhausting retries; false if some were re-queued.
   */
  async flush(): Promise<boolean> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.flushing) return false;
    if (this.queue.length === 0) return true;

    this.flushing = true;
    const batch = this.queue.splice(0, this.maxBatchSize);
    this.persist();

    try {
      const events = batch.map((e) => ({
        learnerId: e.learnerId,
        sessionId: e.sessionId,
        eventType: e.eventType,
        payload: e.payload,
      }));
      const res = await this.fetchImpl(this.endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ events }),
        keepalive: true,
      });
      if (!res.ok && res.status >= 500) {
        this.requeue(batch);
      }
    } catch {
      this.requeue(batch);
    } finally {
      this.flushing = false;
    }

    return this.queue.length === 0;
  }

  private requeue(batch: BufferedTelemetryEvent[]) {
    const retryable = batch
      .map((e) => ({ ...e, attempts: e.attempts + 1 }))
      .filter((e) => e.attempts <= MAX_ATTEMPTS);
    this.queue.unshift(...retryable);
    this.persist();
    this.scheduleRetry();
    // Ask the PWA service worker to register a Background Sync so the
    // browser retries when connectivity is restored even if the tab
    // has been closed. The SW handler in `public/sw.js` posts back a
    // "telemetry-flush" message; pwa-register listens for that.
    this.requestServiceWorkerSync();
  }

  private requestServiceWorkerSync() {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.ready
      .then((reg) => {
        reg.active?.postMessage({ type: "telemetry-sync" });
      })
      .catch(() => undefined);
  }

  private scheduleFlush() {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, this.debounceMs);
  }

  private scheduleRetry() {
    if (this.retryTimer) return;
    const nextAttempts = Math.max(0, ...this.queue.map((e) => e.attempts));
    const backoff = Math.min(60_000, BACKOFF_BASE_MS * Math.pow(2, Math.max(0, nextAttempts - 1)));
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.flush();
    }, backoff);
  }

  private persist() {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.queue));
    } catch {
      // Storage may be unavailable in private mode — fall back to memory.
    }
  }

  private hydrate() {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as BufferedTelemetryEvent[];
      if (Array.isArray(parsed)) {
        this.queue = parsed.filter(
          (e): e is BufferedTelemetryEvent =>
            !!e && typeof e === "object" && typeof e.eventType === "string",
        );
        if (this.queue.length > 0) this.scheduleFlush();
      }
    } catch {
      // Corrupt buffer — drop and reset.
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
    }
  }

  private attachLifecycleListeners() {
    if (typeof window === "undefined") return;
    const flushNow = () => {
      void this.flush();
    };
    // beforeunload / pagehide: try a `keepalive` POST so events ride
    // the closing tab. visibilitychange: flush when hidden (mobile
    // background) to avoid losing events when the tab is suspended.
    window.addEventListener("pagehide", flushNow);
    window.addEventListener("beforeunload", flushNow);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flushNow();
    });
    window.addEventListener("online", flushNow);
  }
}

let singleton: TelemetryBuffer | null = null;

export function getTelemetryBuffer(opts?: BufferOptions): TelemetryBuffer {
  if (typeof window === "undefined") {
    return new TelemetryBuffer(opts); // server fallback — not actually used
  }
  if (!singleton) singleton = new TelemetryBuffer(opts);
  return singleton;
}

/**
 * Convenience helper — most call sites only need the event payload.
 */
export function recordSurfaceTelemetry(
  event: Omit<BufferedTelemetryEvent, "enqueuedAt" | "attempts">,
): void {
  getTelemetryBuffer().enqueue(event);
}

// Test-only escape hatch so vitest specs can reset the singleton.
export function __resetTelemetryBufferForTests(): void {
  singleton = null;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
}
