/**
 * Cross-replica pub/sub bus for live-fan-out surfaces.
 *
 * Subjects we publish today:
 *   inbox.thread.<threadId>            — a new message landed on a thread
 *   session.coview.<learnerId>         — a learner's lesson-session row moved
 *
 * Two implementations, chosen by `createRealtimeBus()`:
 *
 *   - **NATS** (production / staging): when `NATS_URL` is set AND the `nats`
 *     module resolves at runtime. Real cross-replica fan-out.
 *   - **In-process EventEmitter** (dev / tests / single-replica): a
 *     module-singleton EventEmitter shared by every `createRealtimeBus()`
 *     call inside the same node process. This is NOT cross-replica, but it
 *     keeps the SSE routes working end-to-end without a broker so dev and
 *     unit tests don't require docker-nats.
 *
 * The bus is intentionally minimal: subscribe(subject, handler) → unsubscribe.
 * Wildcard subscriptions are not needed by the current callers.
 */
import { EventEmitter } from "node:events";

export type Handler = (payload: unknown) => void;
export type Unsubscribe = () => void;

export interface RealtimeBus {
  /** Best-effort publish. Never throws. */
  publish(subject: string, payload: unknown): Promise<void>;
  /** Returns an unsubscribe callback. */
  subscribe(subject: string, handler: Handler): Promise<Unsubscribe>;
  /** Release resources (e.g. NATS connection). */
  close(): Promise<void>;
  /** Which backend is in use — surfaced for diagnostics + tests. */
  readonly backend: "nats" | "in-process";
}

// ─────────────────────────── In-process bus ───────────────────────────

/**
 * Module-singleton EventEmitter. Two `createRealtimeBus()` calls inside the
 * same node process share this emitter, so an integration test can boot two
 * Fastify instances and exercise the publish→subscribe contract without a
 * broker. In production, each replica has its own emitter — which is exactly
 * why the NATS backend exists.
 */
const sharedEmitter = new EventEmitter();
// SSE fan-out can have many subscribers per subject; raise the cap so node
// doesn't warn about a "memory leak" when the inbox is busy.
sharedEmitter.setMaxListeners(0);

function inProcessBus(): RealtimeBus {
  return {
    backend: "in-process",
    async publish(subject, payload) {
      sharedEmitter.emit(subject, payload);
    },
    async subscribe(subject, handler) {
      sharedEmitter.on(subject, handler);
      return () => sharedEmitter.off(subject, handler);
    },
    async close() {
      /* shared emitter is module-scoped; nothing to release */
    },
  };
}

/** Test hook — drop every subscriber from the shared in-process emitter. */
export function _resetInProcessBusForTest(): void {
  sharedEmitter.removeAllListeners();
}

// ──────────────────────────────── NATS ────────────────────────────────

interface NatsLikeConnection {
  publish(subject: string, data: Uint8Array): void;
  subscribe(subject: string, opts?: { callback?: (err: unknown, msg: unknown) => void }): {
    unsubscribe(): void;
  };
  drain(): Promise<void>;
  close(): Promise<void> | void;
}

interface NatsLikeModule {
  connect(opts: { servers: string }): Promise<NatsLikeConnection>;
  StringCodec?(): { encode(s: string): Uint8Array; decode(b: Uint8Array): string };
}

async function loadNats(): Promise<NatsLikeModule | null> {
  // Lazy-require so the service doesn't hard-depend on `nats` in tests
  // or in dev environments without a broker. Mirrors engagement-svc.
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = await import(/* @vite-ignore */ "nats" as string);
    if (mod && typeof mod.connect === "function") return mod as NatsLikeModule;
    return null;
  } catch {
    return null;
  }
}

async function natsBus(url: string): Promise<RealtimeBus | null> {
  const mod = await loadNats();
  if (!mod) return null;
  let nc: NatsLikeConnection;
  try {
    nc = await mod.connect({ servers: url });
  } catch {
    return null;
  }
  const encode = (s: string) => new TextEncoder().encode(s);
  const decode = (b: Uint8Array) => new TextDecoder().decode(b);

  return {
    backend: "nats",
    async publish(subject, payload) {
      try {
        nc.publish(subject, encode(JSON.stringify(payload)));
      } catch {
        /* best-effort */
      }
    },
    async subscribe(subject, handler) {
      const sub = nc.subscribe(subject, {
        callback: (_err, msg) => {
          try {
            // NATS msg has .data: Uint8Array; we tolerate alternative shapes.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const data = (msg as any)?.data;
            const text = data instanceof Uint8Array ? decode(data) : String(data ?? "");
            const parsed = text ? JSON.parse(text) : null;
            handler(parsed);
          } catch {
            /* ignore malformed payload — next msg will retry */
          }
        },
      });
      return () => {
        try {
          sub.unsubscribe();
        } catch {
          /* ignore */
        }
      };
    },
    async close() {
      try {
        await nc.drain();
      } catch {
        try {
          await nc.close();
        } catch {
          /* ignore */
        }
      }
    },
  };
}

// ─────────────────────────────── Factory ───────────────────────────────

let cached: { url: string | undefined; bus: RealtimeBus } | null = null;

/**
 * Returns a process-wide singleton bus. Re-uses the same NATS connection
 * across routes/publishers so we don't open a socket per request.
 *
 * Resolution order:
 *   1. NATS when `NATS_URL` is set AND the `nats` module resolves.
 *   2. In-process EventEmitter otherwise.
 */
export async function getRealtimeBus(): Promise<RealtimeBus> {
  const url = process.env.NATS_URL;
  if (cached && cached.url === url) return cached.bus;
  let bus: RealtimeBus | null = null;
  if (url) bus = await natsBus(url);
  if (!bus) bus = inProcessBus();
  cached = { url, bus };
  return bus;
}

/** Test hook — drop the cached bus + reset the in-process emitter. */
export async function _resetRealtimeBusForTest(): Promise<void> {
  if (cached) {
    try {
      await cached.bus.close();
    } catch {
      /* ignore */
    }
    cached = null;
  }
  _resetInProcessBusForTest();
}

/** Subject builders — single source of truth for the wire format. */
export const subjects = {
  inboxThread: (threadId: string) => `inbox.thread.${threadId}`,
  sessionCoview: (learnerId: string) => `session.coview.${learnerId}`,
} as const;
