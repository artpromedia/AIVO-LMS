/**
 * W3C Trace Context (traceparent / tracestate) + W3C Baggage.
 *
 * A self-contained, dependency-light implementation so every AIVO service
 * can propagate trace_id and tenant_id without pulling the full
 * OpenTelemetry SDK into restricted/offline build environments. The wire
 * formats are spec-compliant, so a future swap to the OTel SDK is drop-in.
 *
 *   traceparent: version-traceId-spanId-flags
 *                00-<32 hex>-<16 hex>-01
 *   baggage:     key1=value1,key2=value2   (we carry tenant_id)
 */
import { randomBytes } from "node:crypto";

export interface SpanContext {
  traceId: string; // 32 hex
  spanId: string; // 16 hex
  parentSpanId?: string;
  sampled: boolean;
}

const TRACEPARENT_RE = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/;

export function randomHex(bytes: number): string {
  return randomBytes(bytes).toString("hex");
}

export function newTraceId(): string {
  return randomHex(16);
}
export function newSpanId(): string {
  return randomHex(8);
}

/** Parse an incoming traceparent header into a SpanContext, or null. */
export function parseTraceparent(header: string | undefined): SpanContext | null {
  if (!header) return null;
  const m = TRACEPARENT_RE.exec(header.trim());
  if (!m) return null;
  const [, traceId, spanId, flags] = m;
  if (traceId === "0".repeat(32) || spanId === "0".repeat(16)) return null;
  return {
    traceId,
    spanId: newSpanId(), // we are a new span; the incoming spanId is our parent
    parentSpanId: spanId,
    sampled: (parseInt(flags, 16) & 0x01) === 1,
  };
}

/** Serialize a SpanContext to a traceparent header value. */
export function formatTraceparent(ctx: SpanContext): string {
  const flags = ctx.sampled ? "01" : "00";
  return `00-${ctx.traceId}-${ctx.spanId}-${flags}`;
}

/** Start a fresh root span context. */
export function startSpanContext(): SpanContext {
  return { traceId: newTraceId(), spanId: newSpanId(), sampled: true };
}

/**
 * Continue a trace from incoming headers, or start a new one. The returned
 * context represents *this* service's span.
 */
export function contextFromHeaders(headers: Record<string, unknown>): SpanContext {
  const traceparent =
    typeof headers["traceparent"] === "string" ? headers["traceparent"] : undefined;
  return parseTraceparent(traceparent) ?? startSpanContext();
}

// ── W3C Baggage ────────────────────────────────────────────────────────────

export type Baggage = Record<string, string>;

export function parseBaggage(header: string | undefined): Baggage {
  const out: Baggage = {};
  if (!header) return out;
  for (const pair of header.split(",")) {
    const idx = pair.indexOf("=");
    if (idx <= 0) continue;
    const key = pair.slice(0, idx).trim();
    const value = decodeURIComponent(pair.slice(idx + 1).trim());
    if (key) out[key] = value;
  }
  return out;
}

export function formatBaggage(baggage: Baggage): string {
  return Object.entries(baggage)
    .filter(([k, v]) => k && v != null)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join(",");
}

export const TENANT_BAGGAGE_KEY = "tenant_id";

export function tenantFromBaggage(headers: Record<string, unknown>): string | undefined {
  const raw = typeof headers["baggage"] === "string" ? headers["baggage"] : undefined;
  return parseBaggage(raw)[TENANT_BAGGAGE_KEY];
}
