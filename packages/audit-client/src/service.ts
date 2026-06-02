/**
 * Service-side convenience wiring (Sprint 3).
 *
 * `createServiceAuditClient()` builds an HTTP-backed client from env
 * (AUDIT_SVC_URL + INTERNAL_SERVICE_TOKEN). `installAuditing(app)` registers
 * the auto-emit `onResponse` hook so any route annotated with `audited(...)`
 * produces an event — the one line each producer service adds to its
 * `buildApp`.
 *
 * Emission is best-effort: if AUDIT_SVC_URL is unset (local/test) the client
 * uses a no-op transport so wiring never breaks a service that runs without
 * audit-svc.
 */
import { createAuditClient, HttpAuditTransport, type AuditClient, type AuditTransport } from "./emit.js";
import { registerAuditHook, type AuditHookOptions } from "./audited.js";

class NoopTransport implements AuditTransport {
  async send(): Promise<void> {
    /* audit-svc not configured — drop (best-effort) */
  }
}

export interface ServiceAuditOptions {
  /** Override the audit-svc base URL (defaults to env AUDIT_SVC_URL). */
  url?: string;
  /** Override the service token (defaults to env INTERNAL_SERVICE_TOKEN). */
  serviceToken?: string;
  fetchImpl?: typeof fetch;
  defaultAllowlist?: readonly string[];
  onError?: (err: unknown) => void;
}

export function createServiceAuditClient(opts: ServiceAuditOptions = {}): AuditClient {
  const url = opts.url ?? process.env.AUDIT_SVC_URL ?? "";
  const serviceToken = opts.serviceToken ?? process.env.INTERNAL_SERVICE_TOKEN ?? "";
  const transport: AuditTransport =
    url && serviceToken
      ? new HttpAuditTransport({ url, serviceToken, fetchImpl: opts.fetchImpl })
      : new NoopTransport();
  return createAuditClient({
    transport,
    defaultAllowlist: opts.defaultAllowlist,
    onError: opts.onError ? (e) => opts.onError!(e) : undefined,
  });
}

/**
 * One-liner for a service's buildApp: builds the client and registers the
 * auto-emit hook. Returns the client so the service can also emit manually.
 */
export function installAuditing(
  app: Parameters<typeof registerAuditHook>[0],
  opts: ServiceAuditOptions & AuditHookOptions = {},
): AuditClient {
  const client = createServiceAuditClient(opts);
  registerAuditHook(app, client, opts);
  return client;
}
