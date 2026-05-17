import pino from "pino";
import { randomUUID } from "node:crypto";

export * from "./safe-logger.js";
export * from "./learning-traces.js";
export * from "./llm-traces.js";

// ── Sensitive-key sanitisation ─────────────────────────────────────────────

const SENSITIVE_KEY_RE = /token|key|secret|password|credential|auth/i;

/**
 * Recursively strips any key whose name matches the sensitive-key pattern
 * from the supplied object. The original object is not mutated.
 */
export function sanitize<T>(data: T, depth = 0): T {
  if (depth > 10 || data === null || typeof data !== "object") return data;
  if (Array.isArray(data)) {
    return data.map((v) => sanitize(v, depth + 1)) as unknown as T;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
    if (SENSITIVE_KEY_RE.test(k)) {
      out[k] = "[REDACTED]";
    } else {
      out[k] = sanitize(v, depth + 1);
    }
  }
  return out as T;
}

// ── Logger factory ─────────────────────────────────────────────────────────

export interface Logger {
  // Preferred (new) signature: message first, optional structured data.
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
  debug(message: string, data?: Record<string, unknown>): void;
  // Backwards-compat overloads for pino-style callers (data first, optional msg)
  // and `logger.error(err, "msg")` shorthand. Internally normalised.
  info(data: Record<string, unknown>, message?: string): void;
  warn(data: Record<string, unknown>, message?: string): void;
  error(data: Record<string, unknown> | Error | unknown, message?: string): void;
  debug(data: Record<string, unknown>, message?: string): void;
}

export function createLogger(serviceName: string, context?: Record<string, unknown>): Logger {
  const base = pino({
    name: serviceName,
    level: process.env.LOG_LEVEL || "info",
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level(label) { return { level: label }; },
    },
    base: context ? sanitize({ service: serviceName, ...context }) : { service: serviceName },
  });

  function normalise(a: unknown, b: unknown): { message: string; data: Record<string, unknown> } {
    if (typeof a === "string") {
      const data = b && typeof b === "object" ? (b as Record<string, unknown>) : {};
      return { message: a, data };
    }
    // Legacy pino-style: first arg is the structured payload (or an Error).
    const message = typeof b === "string" ? b : "";
    let data: Record<string, unknown> = {};
    if (a instanceof Error) {
      data = { err: a.message, stack: a.stack, name: a.name };
    } else if (a && typeof a === "object") {
      data = a as Record<string, unknown>;
    } else if (a !== undefined) {
      data = { value: a };
    }
    return { message, data };
  }

  function log(level: "info" | "warn" | "error" | "debug", a: unknown, b: unknown) {
    const { message, data } = normalise(a, b);
    base[level](sanitize(data), message);
  }

  return {
    info: ((a: unknown, b?: unknown) => log("info", a, b)) as Logger["info"],
    warn: ((a: unknown, b?: unknown) => log("warn", a, b)) as Logger["warn"],
    error: ((a: unknown, b?: unknown) => log("error", a, b)) as Logger["error"],
    debug: ((a: unknown, b?: unknown) => log("debug", a, b)) as Logger["debug"],
  };
}

// ── Legacy createLogger compat (returns pino instance for existing consumers) ──
export { createLogger as createPinoLogger };
export type { Logger as PinoLogger };

// ── Metrics registry ───────────────────────────────────────────────────────

interface LabelSet { [label: string]: string }

export interface Counter {
  increment(value?: number, labelValues?: LabelSet): void;
}

export interface Histogram {
  record(value: number, labelValues?: LabelSet): void;
}

interface CounterState {
  name: string;
  labels: string[];
  counts: Map<string, number>;
}

interface HistogramState {
  name: string;
  labels: string[];
  buckets: number[];
  bucketCounts: Map<string, number[]>;
  sums: Map<string, number>;
  counts: Map<string, number>;
}

const _counters: CounterState[] = [];
const _histograms: HistogramState[] = [];

function labelKey(labelValues: LabelSet): string {
  return JSON.stringify(labelValues, Object.keys(labelValues).sort());
}

export function createCounter(name: string, labels: string[] = []): Counter {
  const state: CounterState = { name, labels, counts: new Map() };
  _counters.push(state);
  return {
    increment(value = 1, labelValues: LabelSet = {}) {
      const key = labelKey(labelValues);
      state.counts.set(key, (state.counts.get(key) ?? 0) + value);
    },
  };
}

const DEFAULT_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

export function createHistogram(
  name: string,
  buckets: number[] = DEFAULT_BUCKETS,
  labels: string[] = [],
): Histogram {
  const state: HistogramState = { name, labels, buckets, bucketCounts: new Map(), sums: new Map(), counts: new Map() };
  _histograms.push(state);
  return {
    record(value: number, labelValues: LabelSet = {}) {
      const key = labelKey(labelValues);
      const bc = state.bucketCounts.get(key) ?? new Array(state.buckets.length + 1).fill(0);
      for (let i = 0; i < state.buckets.length; i++) {
        if (value <= state.buckets[i]) bc[i] += 1;
      }
      bc[state.buckets.length] += 1; // +Inf bucket
      state.bucketCounts.set(key, bc);
      state.sums.set(key, (state.sums.get(key) ?? 0) + value);
      state.counts.set(key, (state.counts.get(key) ?? 0) + 1);
    },
  };
}

export function exportMetrics(): string {
  const lines: string[] = [];

  for (const c of _counters) {
    lines.push(`# TYPE ${c.name} counter`);
    for (const [labelsJson, val] of c.counts) {
      const lv = JSON.parse(labelsJson) as LabelSet;
      const labelStr = Object.entries(lv)
        .map(([k, v]) => `${k}="${v}"`)
        .join(",");
      lines.push(labelStr ? `${c.name}{${labelStr}} ${val}` : `${c.name} ${val}`);
    }
  }

  for (const h of _histograms) {
    lines.push(`# TYPE ${h.name} histogram`);
    for (const [labelsJson, bc] of h.bucketCounts) {
      const lv = JSON.parse(labelsJson) as LabelSet;
      const base = Object.entries(lv)
        .map(([k, v]) => `${k}="${v}"`)
        .join(",");
      h.buckets.forEach((b, i) => {
        const l = base ? `${base},le="${b}"` : `le="${b}"`;
        lines.push(`${h.name}_bucket{${l}} ${bc[i]}`);
      });
      const infL = base ? `${base},le="+Inf"` : `le="+Inf"`;
      lines.push(`${h.name}_bucket{${infL}} ${bc[h.buckets.length]}`);
      const suffix = base ? `{${base}}` : "";
      lines.push(`${h.name}_sum${suffix} ${h.sums.get(labelsJson) ?? 0}`);
      lines.push(`${h.name}_count${suffix} ${h.counts.get(labelsJson) ?? 0}`);
    }
  }

  return lines.join("\n");
}

/** Reset all metric state (for tests only). */
export function _resetMetrics(): void {
  _counters.length = 0;
  _histograms.length = 0;
}

// ── Trace span helper ──────────────────────────────────────────────────────

export async function withSpan<T>(
  name: string,
  fn: () => Promise<T>,
  attributes: Record<string, string> = {},
): Promise<T> {
  const startMs = Date.now();
  let threw = false;
  try {
    return await fn();
  } catch (err) {
    threw = true;
    throw err;
  } finally {
    const durationMs = Date.now() - startMs;
    // Emit to stdout as a structured log line so it can be forwarded to an
    // OTel collector later without code changes.
    process.stdout.write(
      JSON.stringify({
        level: "trace",
        span: name,
        durationMs,
        threw,
        ...attributes,
        timestamp: new Date().toISOString(),
      }) + "\n",
    );
  }
}

// ── Request ID propagation (unchanged from original) ──────────────────────

export const REQUEST_ID_HEADER = "x-request-id";

export function generateRequestId(): string {
  return randomUUID();
}

export function registerRequestIdHook(app: any) {
  app.addHook("onRequest", async (req: any, reply: any) => {
    const incoming = req.headers[REQUEST_ID_HEADER];
    const id =
      typeof incoming === "string" && incoming.length > 0 && incoming.length <= 128
        ? incoming
        : generateRequestId();
    req.requestId = id;
    reply.header(REQUEST_ID_HEADER, id);
  });
}

export function propagateHeaders(req: any, extra: Record<string, string> = {}): Record<string, string> {
  const out: Record<string, string> = { ...extra };
  if (req?.requestId) out[REQUEST_ID_HEADER] = req.requestId;
  return out;
}

// ── Re-export Fastify plugin for convenience ───────────────────────────────
export { registerObservabilityPlugin } from "./fastify-plugin.js";
