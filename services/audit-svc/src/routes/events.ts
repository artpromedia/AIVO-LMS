/**
 * Sprint 3 — the `/events` surface (append-only query + proof + export).
 *
 *   POST /events                  internal append (service / platform only)
 *   GET  /events                  paged query with filters + free-text q
 *   GET  /events/:id              single event + hash-chain proof
 *   GET  /export?format=csv|json|ndjson  streaming export (constant memory)
 *   GET  /events/verify?from=&to= chain verification, optionally ranged
 *
 * Sprint B4 — tenant isolation: tenant-scoped principals (district/school
 * staff) are FORCED onto their own tenant's slice for query/export/proof —
 * district A can never export district B. Exports are themselves audited
 * (`audit.exported`) before the first byte streams.
 */
import type { FastifyInstance } from "fastify";
import type { AuditEventInput } from "@aivo/audit-client";
import type { EventStore, EventFilter } from "../services/event-store.js";

/** Principals allowed to see across tenants / append events. */
const UNSCOPED_ROLES = new Set(["service", "platform_admin"]);

interface ScopedRequestLike {
  enterpriseContext?: {
    actorId?: string;
    actorRole?: string;
    tenant?: { tenantId?: string; role?: string };
    requestId?: string;
  };
}

/**
 * Resolve the caller's tenant scope. Returns:
 *  - `{ scoped: false }` for service/platform principals (and when auth is
 *    disabled — the auth hook 401s unauthenticated requests in real
 *    deployments, so a missing context can only mean skipAuth/tests),
 *  - `{ scoped: true, tenantId }` for tenant principals,
 *  - `null` for tenant principals WITHOUT a tenant id (refused).
 */
function tenantScope(req: ScopedRequestLike): { scoped: boolean; tenantId?: string } | null {
  const ctx = req.enterpriseContext;
  if (!ctx) return { scoped: false };
  const role = ctx.tenant?.role ?? ctx.actorRole;
  if (role && UNSCOPED_ROLES.has(role)) return { scoped: false };
  const tenantId = ctx.tenant?.tenantId;
  if (!tenantId) return null;
  return { scoped: true, tenantId };
}

function parseFilter(q: Record<string, unknown>): EventFilter {
  const s = (k: string) => (typeof q[k] === "string" ? (q[k] as string) : undefined);
  const n = (k: string) => (q[k] != null && !Number.isNaN(Number(q[k])) ? Number(q[k]) : undefined);
  return {
    tenantId: s("tenantId"),
    actorId: s("actorId"),
    actorRole: s("actorRole"),
    action: s("action"),
    entityType: s("entityType"),
    entityId: s("entityId"),
    from: s("from"),
    to: s("to"),
    q: s("q"),
    limit: n("limit"),
    cursor: s("cursor"),
  };
}

const CSV_COLUMNS = [
  "id",
  "occurred_at",
  "tenant_id",
  "actor_id",
  "actor_role",
  "actor_ip",
  "action",
  "entity_type",
  "entity_id",
  "outcome",
  "request_id",
  "hash",
] as const;

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function registerEventRoutes(app: FastifyInstance, store: EventStore): void {
  app.post<{ Body: AuditEventInput }>("/events", async (request, reply) => {
    const scope = tenantScope(request as ScopedRequestLike);
    if (scope === null || scope.scoped) {
      // Tenant principals never append platform audit events directly —
      // producers are services (and the platform console).
      return reply.code(403).send({ error: "service or platform principal required" });
    }
    const b = request.body;
    if (!b?.action || !b?.actor?.id || !b?.entity?.type || !b?.outcome) {
      return reply.code(400).send({ error: "action, actor.id, entity.type, outcome are required" });
    }
    const event = await store.append(b);
    return reply.code(201).send(event);
  });

  app.get("/events", async (request, reply) => {
    const scope = tenantScope(request as ScopedRequestLike);
    if (scope === null) return reply.code(403).send({ error: "no tenant context" });
    const filter = parseFilter((request.query ?? {}) as Record<string, unknown>);
    if (scope.scoped) filter.tenantId = scope.tenantId;
    return store.query(filter);
  });

  // Static route resolves before the `:id` param route in Fastify's router.
  // Range-verifiable (Sprint B4): ?from=&to= ISO bounds. Returns integrity
  // metadata only, so tenant principals may call it for their dispute story.
  app.get("/events/verify", async (request) => {
    const query = (request.query ?? {}) as Record<string, unknown>;
    const from = typeof query.from === "string" ? query.from : undefined;
    const to = typeof query.to === "string" ? query.to : undefined;
    const breakAt = await store.verify(from || to ? { from, to } : undefined);
    return {
      intact: breakAt === null,
      break: breakAt,
      brokenAt: breakAt?.id ?? null,
      from: from ?? null,
      to: to ?? null,
    };
  });

  app.get<{ Params: { id: string } }>("/events/:id", async (request, reply) => {
    const scope = tenantScope(request as ScopedRequestLike);
    if (scope === null) return reply.code(403).send({ error: "no tenant context" });
    const event = await store.getById(request.params.id);
    // Cross-tenant ids 404 (not 403): don't confirm the event exists.
    if (!event || (scope.scoped && event.tenant_id !== scope.tenantId)) {
      return reply.code(404).send({ error: "not found" });
    }
    const proof = await store.proof(request.params.id);
    return { event, proof };
  });

  app.get("/export", async (request, reply) => {
    const scope = tenantScope(request as ScopedRequestLike);
    if (scope === null) return reply.code(403).send({ error: "no tenant context" });
    const query = (request.query ?? {}) as Record<string, unknown>;
    const format = (typeof query.format === "string" ? query.format : "json").toLowerCase();
    const filter = parseFilter(query);
    if (scope.scoped) filter.tenantId = scope.tenantId;

    // The export itself is an audit event — appended BEFORE streaming so
    // "who exported what" holds even for aborted downloads.
    const ctx = (request as ScopedRequestLike).enterpriseContext;
    const headers = request.headers as Record<string, string | string[] | undefined>;
    const headerValue = (name: string): string => {
      const v = headers[name];
      return typeof v === "string" ? v : Array.isArray(v) ? (v[0] ?? "") : "";
    };
    await store.append({
      occurred_at: new Date().toISOString(),
      tenant_id: scope.scoped ? (scope.tenantId ?? null) : (filter.tenantId ?? null),
      actor: {
        id: ctx?.actorId ?? "",
        role: ctx?.tenant?.role ?? ctx?.actorRole ?? "service",
        ip: headerValue("x-forwarded-for").split(",")[0]?.trim() || (request.ip ?? ""),
        ua: headerValue("user-agent"),
      },
      action: "audit.exported",
      entity: { type: "audit_export", id: "" },
      outcome: "success",
      details: {
        format,
        from: filter.from ?? null,
        to: filter.to ?? null,
        action: filter.action ?? null,
      },
      request_id: ctx?.requestId ?? headerValue("x-request-id"),
    });

    if (format === "csv") {
      reply.header("content-type", "text/csv; charset=utf-8");
      reply.header("content-disposition", 'attachment; filename="audit-export.csv"');
      reply.raw.write(CSV_COLUMNS.join(",") + "\n");
      for await (const e of store.stream(filter)) {
        const row = [
          e.id,
          e.occurred_at,
          e.tenant_id,
          e.actor.id,
          e.actor.role,
          e.actor.ip,
          e.action,
          e.entity.type,
          e.entity.id,
          e.outcome,
          e.request_id,
          e.hash,
        ];
        reply.raw.write(row.map(csvCell).join(",") + "\n");
      }
      reply.raw.end();
      return reply;
    }

    if (format === "ndjson") {
      reply.header("content-type", "application/x-ndjson; charset=utf-8");
      reply.header("content-disposition", 'attachment; filename="audit-export.ndjson"');
      for await (const e of store.stream(filter)) {
        reply.raw.write(JSON.stringify(e) + "\n");
      }
      reply.raw.end();
      return reply;
    }

    // json: stream a well-formed array without buffering all rows.
    reply.header("content-type", "application/json; charset=utf-8");
    reply.header("content-disposition", 'attachment; filename="audit-export.json"');
    reply.raw.write("[");
    let first = true;
    for await (const e of store.stream(filter)) {
      reply.raw.write((first ? "" : ",") + JSON.stringify(e));
      first = false;
    }
    reply.raw.write("]");
    reply.raw.end();
    return reply;
  });
}
