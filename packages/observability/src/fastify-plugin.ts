/**
 * Fastify plugin that adds:
 *  - Request/response structured logging (method, path, status_code, duration_ms, tenant_id, request_id)
 *  - GET /metrics endpoint returning Prometheus text format
 *  - Common http_requests_total counter and http_request_duration_seconds histogram
 */
import { randomUUID } from "node:crypto";
import {
  createLogger,
  createCounter,
  createHistogram,
  exportMetrics,
  REQUEST_ID_HEADER,
} from "./index.js";

export function registerObservabilityPlugin(app: any, serviceName: string) {
  const logger = createLogger(serviceName);
  const requestsTotal = createCounter("http_requests_total", ["method", "path", "status"]);
  const requestDuration = createHistogram("http_request_duration_seconds", undefined, [
    "method",
    "path",
  ]);

  // Request ID hook
  app.addHook("onRequest", async (req: any, reply: any) => {
    const incoming = req.headers[REQUEST_ID_HEADER];
    const id =
      typeof incoming === "string" && incoming.length > 0 && incoming.length <= 128
        ? incoming
        : randomUUID();
    req.requestId = id;
    req.startMs = Date.now();
    reply.header(REQUEST_ID_HEADER, id);
  });

  // Handler errors are otherwise invisible: services register Fastify with
  // `logger: false`, so a thrown error becomes a bare 500 with no log line.
  app.addHook("onError", async (req: any, reply: any, error: any) => {
    const statusCode = Number(error?.statusCode ?? reply?.statusCode ?? 500);
    const level = statusCode >= 500 ? "error" : "warn";
    logger[level]("request_error", {
      method: req.method ?? "UNKNOWN",
      path: req.routeOptions?.url ?? req.url ?? "unknown",
      status_code: statusCode,
      request_id: req.requestId,
      err: error?.message,
      err_cause: error?.cause?.message,
      stack: error?.stack,
    });
  });

  // Response logging hook
  app.addHook("onResponse", async (req: any, reply: any) => {
    const durationMs = Date.now() - (req.startMs ?? Date.now());
    const path = req.routeOptions?.url ?? req.url ?? "unknown";
    const method = req.method ?? "UNKNOWN";
    const statusCode = reply.statusCode;

    // Extract tenant_id from JWT claims if available
    const tenantId = (req as any).claims?.tenantId ?? null;

    logger.info("http_request", {
      method,
      path,
      status_code: statusCode,
      duration_ms: durationMs,
      request_id: req.requestId,
      ...(tenantId ? { tenant_id: tenantId } : {}),
    });

    requestsTotal.increment(1, { method, path, status: String(statusCode) });
    requestDuration.record(durationMs / 1000, { method, path });
  });

  // /metrics endpoint
  app.get("/metrics", async (_req: any, reply: any) => {
    reply.header("Content-Type", "text/plain; version=0.0.4");
    return exportMetrics();
  });
}
