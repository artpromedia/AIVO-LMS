/**
 * `@audited(...)` route annotation + the auto-emit hook (Sprint 3).
 *
 * Usage in a service:
 *
 *   app.post("/idp", { ...audited("identity.idp.created", {
 *     entityType: "idp",
 *     entityId: (req) => (req.body as any).id,
 *     detailsAllowlist: ["protocol", "tenantId"],
 *   }) }, handler);
 *
 *   registerAuditHook(app, auditClient, { resolveActor });
 *
 * The hook fires on response for any route carrying an `audit` config and
 * emits a structured event with outcome derived from the status code
 * (2xx/3xx => success, 4xx/5xx => failure). Typed structurally so this
 * package needs no hard Fastify dependency.
 */
import type { AuditClient } from "./emit.js";
import type { AuditActor } from "./event.js";

export interface AuditedRequestLike {
  method: string;
  url: string;
  ip?: string;
  headers: Record<string, unknown>;
  body?: unknown;
  params?: unknown;
  query?: unknown;
  routeOptions?: { config?: { audit?: AuditConfig } };
  // Populated by an upstream auth hook when available.
  enterpriseContext?: { actorId?: string; tenant?: { tenantId?: string; role?: string } };
  user?: { sub?: string; role?: string; tenantId?: string };
}

export interface AuditedReplyLike {
  statusCode: number;
}

export interface AuditConfig {
  action: string;
  entityType?: string;
  entityId?: (req: AuditedRequestLike) => string | undefined;
  detailsAllowlist?: readonly string[];
  details?: (req: AuditedRequestLike, reply: AuditedReplyLike) => Record<string, unknown>;
}

/** Spread the result into a route's options to annotate it for auditing. */
export function audited(action: string, opts: Omit<AuditConfig, "action"> = {}) {
  return { config: { audit: { action, ...opts } } as { audit: AuditConfig } };
}

export interface AuditHookOptions {
  /** Resolve the acting principal from the request (auth context / headers). */
  resolveActor?: (req: AuditedRequestLike) => AuditActor;
  /** Resolve the tenant id; defaults to auth context, else null (platform). */
  resolveTenantId?: (req: AuditedRequestLike) => string | null;
}

function header(req: AuditedRequestLike, name: string): string {
  const v = req.headers[name];
  if (typeof v === "string") return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  return "";
}

function defaultActor(req: AuditedRequestLike): AuditActor {
  const ctx = req.enterpriseContext;
  const id = ctx?.actorId ?? req.user?.sub ?? header(req, "x-actor-id") ?? "";
  const role = ctx?.tenant?.role ?? req.user?.role ?? header(req, "x-actor-role") ?? "service";
  const ip = header(req, "x-forwarded-for").split(",")[0]?.trim() || req.ip || "";
  const ua = header(req, "user-agent");
  return { id, role, ip, ua };
}

function defaultTenant(req: AuditedRequestLike): string | null {
  return req.enterpriseContext?.tenant?.tenantId ?? req.user?.tenantId ?? null;
}

/**
 * Register the auto-emit hook. Works with any Fastify-like app exposing
 * `addHook("onResponse", fn)`. Routes without an `audit` config are ignored.
 */
export function registerAuditHook(
  app: {
    addHook: (
      name: "onResponse",
      fn: (req: AuditedRequestLike, reply: AuditedReplyLike) => unknown,
    ) => void;
  },
  client: AuditClient,
  options: AuditHookOptions = {},
): void {
  const resolveActor = options.resolveActor ?? defaultActor;
  const resolveTenant = options.resolveTenantId ?? defaultTenant;

  app.addHook("onResponse", async (req, reply) => {
    const cfg = req.routeOptions?.config?.audit;
    if (!cfg) return;
    const outcome = reply.statusCode < 400 ? "success" : "failure";
    const details = cfg.details ? cfg.details(req, reply) : {};
    await client.emit({
      tenant_id: resolveTenant(req),
      actor: resolveActor(req),
      action: cfg.action,
      entity: { type: cfg.entityType ?? "", id: cfg.entityId?.(req) ?? "" },
      outcome,
      details: { ...details, status: reply.statusCode, method: req.method },
      detailsAllowlist: cfg.detailsAllowlist
        ? [...cfg.detailsAllowlist, "status", "method"]
        : ["status", "method"],
      request_id: header(req, "x-request-id"),
    });
  });
}
