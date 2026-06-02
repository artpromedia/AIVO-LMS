/**
 * Shared HTTP client for upstream services. Per ADR 0009 each service
 * gets its own typed wrapper that uses this client; the wrapper is the
 * thing repos / BFF handlers call. The client itself is intentionally
 * thin — it deals with timeouts, retries, structured logging, and the
 * service-token header. Anything domain-specific belongs in the
 * per-service file.
 */
import { serverEnv } from "@/lib/env";
import { logger } from "@/lib/observability/logger";

export interface ServiceCallOptions {
  /** Logical name of the upstream — appears in logs + metrics. */
  service: string;
  /** Absolute or path-relative URL. Relative paths use `baseUrl`. */
  url: string;
  baseUrl?: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  /** Bearer token; falls back to the per-service default in env. */
  serviceToken?: string;
  /** Override the global AIVO_SERVICE_TIMEOUT_MS. */
  timeoutMs?: number;
  /**
   * Number of additional attempts on retryable errors (5xx + network).
   * Initial attempt + retries; 0 retries means a single attempt.
   * Default: 1 (one retry).
   */
  retries?: number;
  /** Request-id propagated to the upstream for trace correlation. */
  requestId?: string;
}

export interface ServiceCallSuccess<T> {
  ok: true;
  status: number;
  data: T;
  attempts: number;
  latencyMs: number;
}

export interface ServiceCallFailure {
  ok: false;
  status: number | null;
  reason: "non_2xx" | "timeout" | "network_error" | "schema_validation_failed" | "no_url";
  message: string;
  attempts: number;
  latencyMs: number;
}

export type ServiceCallResult<T> = ServiceCallSuccess<T> | ServiceCallFailure;

function backoffMs(attempt: number): number {
  // 50ms, 200ms, 800ms ... capped at 2s.
  return Math.min(50 * Math.pow(4, attempt), 2_000);
}

function isRetryable(status: number | null, reason: ServiceCallFailure["reason"]): boolean {
  if (reason === "timeout" || reason === "network_error") return true;
  if (status === null) return false;
  if (status >= 500 && status < 600) return true;
  return false;
}

/**
 * Perform an HTTP call to an upstream service. Always returns a result
 * object — never throws — so the caller can branch cleanly on failure
 * vs success without try/catch noise.
 */
export async function callService<T = unknown>(
  opts: ServiceCallOptions,
): Promise<ServiceCallResult<T>> {
  if (!opts.baseUrl && !/^https?:\/\//i.test(opts.url)) {
    return {
      ok: false,
      status: null,
      reason: "no_url",
      message: `[service:${opts.service}] no baseUrl configured and url is relative`,
      attempts: 0,
      latencyMs: 0,
    };
  }
  const url = /^https?:\/\//i.test(opts.url)
    ? opts.url
    : `${opts.baseUrl!.replace(/\/$/, "")}/${opts.url.replace(/^\//, "")}`;
  const retries = Math.max(0, opts.retries ?? 1);
  const timeoutMs = opts.timeoutMs ?? serverEnv.AIVO_SERVICE_TIMEOUT_MS;
  const method = opts.method ?? (opts.body ? "POST" : "GET");
  const headers: Record<string, string> = {
    accept: "application/json",
    ...opts.headers,
  };
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  if (opts.serviceToken) headers["authorization"] = `Bearer ${opts.serviceToken}`;
  if (opts.requestId) headers["x-request-id"] = opts.requestId;

  const started = Date.now();
  let lastFailure: ServiceCallFailure | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method,
        headers,
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        let detail = "";
        try {
          detail = (await res.text()).slice(0, 500);
        } catch {
          detail = "";
        }
        lastFailure = {
          ok: false,
          status: res.status,
          reason: "non_2xx",
          message: detail || `HTTP ${res.status}`,
          attempts: attempt + 1,
          latencyMs: Date.now() - started,
        };
        if (!isRetryable(res.status, "non_2xx") || attempt === retries) {
          logger.warn({
            event: "service_call.failed",
            service: opts.service,
            url,
            status: res.status,
            attempts: attempt + 1,
          });
          return lastFailure;
        }
      } else {
        let data: T;
        try {
          data = (await res.json()) as T;
        } catch (err) {
          clearTimeout(timer);
          lastFailure = {
            ok: false,
            status: res.status,
            reason: "schema_validation_failed",
            message: err instanceof Error ? err.message : String(err),
            attempts: attempt + 1,
            latencyMs: Date.now() - started,
          };
          return lastFailure;
        }
        return {
          ok: true,
          status: res.status,
          data,
          attempts: attempt + 1,
          latencyMs: Date.now() - started,
        };
      }
    } catch (err) {
      clearTimeout(timer);
      const aborted =
        err instanceof Error && (err.name === "AbortError" || err.message === "aborted");
      lastFailure = {
        ok: false,
        status: null,
        reason: aborted ? "timeout" : "network_error",
        message: err instanceof Error ? err.message : String(err),
        attempts: attempt + 1,
        latencyMs: Date.now() - started,
      };
      if (attempt === retries) {
        logger.warn({
          event: "service_call.failed",
          service: opts.service,
          url,
          reason: lastFailure.reason,
          attempts: attempt + 1,
        });
        return lastFailure;
      }
    }
    // Sleep before the next retry.
    await new Promise((r) => setTimeout(r, backoffMs(attempt)));
  }
  // Unreachable in practice — the loop always returns or sets lastFailure.
  return (
    lastFailure ?? {
      ok: false,
      status: null,
      reason: "network_error",
      message: "unknown failure",
      attempts: retries + 1,
      latencyMs: Date.now() - started,
    }
  );
}
