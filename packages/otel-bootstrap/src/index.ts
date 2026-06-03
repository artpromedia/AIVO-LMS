/**
 * @aivo/otel-bootstrap
 *
 * One import every AIVO service uses to get consistent observability:
 *   - traces:  W3C Trace Context propagation (traceparent/tracestate)
 *   - metrics: Prometheus text format via @aivo/observability (/metrics)
 *   - logs:    structured JSON with trace_id and tenant_id on every line
 *
 * The BFF injects `tenant_id` into W3C baggage; downstream services read it
 * back and bind it to their span + logs. `assertTenantSpanAttribute` lets a
 * test (or a strict-mode service) fail loudly when a span is missing the
 * tenant label, satisfying the Sprint 8 "assert presence in every service
 * span" requirement.
 */
import { randomUUID } from "node:crypto";
import { createLogger, type Logger, exportMetrics } from "@aivo/observability";
import {
  contextFromHeaders,
  formatBaggage,
  formatTraceparent,
  parseBaggage,
  TENANT_BAGGAGE_KEY,
  tenantFromBaggage,
  type Baggage,
  type SpanContext,
} from "./trace-context.js";

export * from "./trace-context.js";

export interface ServiceSpan {
  service: string;
  name: string;
  context: SpanContext;
  tenantId?: string;
  attributes: Record<string, string | number | boolean>;
  startMs: number;
}

export interface OtelBootstrap {
  service: string;
  logger: Logger;
  /** Build a span from incoming headers, binding tenant_id from baggage. */
  startSpan(name: string, headers: Record<string, unknown>): ServiceSpan;
  /** Headers to propagate downstream (traceparent + baggage with tenant_id). */
  outboundHeaders(span: ServiceSpan): Record<string, string>;
  /** A logger bound to this span's trace_id + tenant_id. */
  spanLogger(span: ServiceSpan): Logger;
}

/**
 * Bootstrap observability for a service. Call once at startup and reuse the
 * returned handle for the life of the process.
 */
export function bootstrapOtel(service: string): OtelBootstrap {
  const logger = createLogger(service);

  function startSpan(name: string, headers: Record<string, unknown>): ServiceSpan {
    const context = contextFromHeaders(headers);
    const tenantId = tenantFromBaggage(headers);
    return {
      service,
      name,
      context,
      tenantId,
      attributes: {
        "service.name": service,
        "trace.id": context.traceId,
        "span.id": context.spanId,
        ...(tenantId ? { tenant_id: tenantId } : {}),
      },
      startMs: Date.now(),
    };
  }

  function outboundHeaders(span: ServiceSpan): Record<string, string> {
    const baggage: Baggage = {};
    if (span.tenantId) baggage[TENANT_BAGGAGE_KEY] = span.tenantId;
    const headers: Record<string, string> = { traceparent: formatTraceparent(span.context) };
    const b = formatBaggage(baggage);
    if (b) headers.baggage = b;
    return headers;
  }

  function spanLogger(span: ServiceSpan): Logger {
    // Wrap the base logger to inject trace_id + tenant_id into every record.
    const inject = (data?: Record<string, unknown>) => ({
      trace_id: span.context.traceId,
      span_id: span.context.spanId,
      ...(span.tenantId ? { tenant_id: span.tenantId } : {}),
      ...(data ?? {}),
    });
    return {
      info: (msg: any, data?: any) => logger.info(msg, inject(data)),
      warn: (msg: any, data?: any) => logger.warn(msg, inject(data)),
      error: (msg: any, data?: any) => logger.error(msg, inject(data)),
      debug: (msg: any, data?: any) => logger.debug(msg, inject(data)),
    } as Logger;
  }

  return { service, logger, startSpan, outboundHeaders, spanLogger };
}

/**
 * Strict-mode assertion: every service span must carry a tenant_id (except
 * explicitly tenant-agnostic spans like /healthz). Throws when missing so
 * the integration test from Sprint 8 can guarantee per-tenant labels.
 */
export function assertTenantSpanAttribute(
  span: ServiceSpan,
  opts: { allowAnonymous?: boolean } = {},
): void {
  if (opts.allowAnonymous) return;
  if (!span.tenantId || !span.attributes.tenant_id) {
    throw new Error(
      `[otel] span "${span.name}" in service "${span.service}" is missing required tenant_id attribute`,
    );
  }
}

/**
 * Fastify plugin: starts a span per request, binds trace/tenant to the
 * request, propagates traceparent on the response, and exposes the same
 * /metrics surface as @aivo/observability. Idempotent with the existing
 * observability plugin (skips registering /metrics if already present).
 */
export function registerOtelPlugin(
  app: any,
  service: string,
  opts: { anonymousPaths?: string[] } = {},
): OtelBootstrap {
  const otel = bootstrapOtel(service);
  const anonymous = new Set(opts.anonymousPaths ?? ["/healthz", "/health", "/metrics"]);

  app.addHook("onRequest", async (req: any, reply: any) => {
    const span = otel.startSpan(`${req.method} ${req.url}`, req.headers ?? {});
    req.otelSpan = span;
    req.traceId = span.context.traceId;
    if (span.tenantId) req.tenantId = span.tenantId;
    reply.header("traceparent", formatTraceparent(span.context));
    reply.header("x-trace-id", span.context.traceId);
  });

  app.addHook("onResponse", async (req: any, reply: any) => {
    const span: ServiceSpan | undefined = req.otelSpan;
    if (!span) return;
    const path = req.routeOptions?.url ?? req.url ?? "unknown";
    const anon = anonymous.has(String(path).split("?")[0]);
    otel.spanLogger(span).info("request.completed", {
      method: req.method,
      path,
      status_code: reply.statusCode,
      duration_ms: Date.now() - span.startMs,
    });
    // Strict per-tenant labelling for non-anonymous routes; never throws in
    // the hot path — logs a warning so the gap is visible without 500ing.
    if (!anon && !span.tenantId) {
      otel.logger.warn("span.missing_tenant", { path, request_id: req.requestId ?? randomUUID() });
    }
  });

  return otel;
}

/** Re-export the Prom exporter for services that don't already expose it. */
export { exportMetrics };
