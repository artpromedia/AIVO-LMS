/**
 * Cross-service pub/sub bus — recommendation-svc copy.
 *
 * Mirrors `services/learning-svc/src/realtime/bus.ts` and
 * `services/comms-svc/src/realtime/bus.ts`: each service owns its own
 * connection without a new shared package. Uses NATS when `NATS_URL` is set
 * and the `nats` client is installed; otherwise falls back to an in-process
 * EventEmitter so single-process dev/CI (and unit tests) work unchanged.
 *
 * recommendation-svc subscribes to `caregiver.observation.created` to derive
 * parent-approval recommendations (Sprint 5, G1/G2).
 */
import { EventEmitter } from "node:events";

export type Handler = (payload: unknown) => void;
export type Unsubscribe = () => void;

export interface RealtimeBus {
  publish(subject: string, payload: unknown): Promise<void>;
  subscribe(subject: string, handler: Handler): Promise<Unsubscribe>;
  close(): Promise<void>;
  readonly backend: "nats" | "in-process";
}

const sharedEmitter = new EventEmitter();
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
      /* shared emitter is module-scoped */
    },
  };
}

export function _resetInProcessBusForTest(): void {
  sharedEmitter.removeAllListeners();
}

interface NatsLikeConnection {
  publish(subject: string, data: Uint8Array): void;
  subscribe(
    subject: string,
    opts?: { callback?: (err: unknown, msg: unknown) => void },
  ): { unsubscribe(): void };
  drain(): Promise<void>;
  close(): Promise<void> | void;
}

interface NatsLikeModule {
  connect(opts: { servers: string }): Promise<NatsLikeConnection>;
}

async function loadNats(): Promise<NatsLikeModule | null> {
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const data = (msg as any)?.data;
            const text = data instanceof Uint8Array ? decode(data) : String(data ?? "");
            const parsed = text ? JSON.parse(text) : null;
            handler(parsed);
          } catch {
            /* ignore malformed payload */
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

let cached: { url: string | undefined; bus: RealtimeBus } | null = null;

export async function getRealtimeBus(): Promise<RealtimeBus> {
  const url = process.env.NATS_URL;
  if (cached && cached.url === url) return cached.bus;
  let bus: RealtimeBus | null = null;
  if (url) bus = await natsBus(url);
  if (!bus) bus = inProcessBus();
  cached = { url, bus };
  return bus;
}

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
