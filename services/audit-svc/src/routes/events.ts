/**
 * Sprint 3 — the `/events` surface (append-only query + proof + export).
 *
 *   POST /events                  internal append (svc:* scope)
 *   GET  /events                  paged query with filters + free-text q
 *   GET  /events/:id              single event + hash-chain proof
 *   GET  /export?format=csv|json|ndjson  streaming export (constant memory)
 *   GET  /events/verify           walk the chain, report the first break
 */
import type { FastifyInstance } from "fastify";
import type { AuditEventInput } from "@aivo/audit-client";
import type { EventStore, EventFilter } from "../services/event-store.js";

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
    const b = request.body;
    if (!b?.action || !b?.actor?.id || !b?.entity?.type || !b?.outcome) {
      return reply.code(400).send({ error: "action, actor.id, entity.type, outcome are required" });
    }
    const event = await store.append(b);
    return reply.code(201).send(event);
  });

  app.get("/events", async (request) => {
    const filter = parseFilter((request.query ?? {}) as Record<string, unknown>);
    return store.query(filter);
  });

  // Static route resolves before the `:id` param route in Fastify's router.
  app.get("/events/verify", async () => {
    const breakAt = await store.verify();
    return { intact: breakAt === null, break: breakAt };
  });

  app.get<{ Params: { id: string } }>("/events/:id", async (request, reply) => {
    const event = await store.getById(request.params.id);
    if (!event) return reply.code(404).send({ error: "not found" });
    const proof = await store.proof(request.params.id);
    return { event, proof };
  });

  app.get("/export", async (request, reply) => {
    const query = (request.query ?? {}) as Record<string, unknown>;
    const format = (typeof query.format === "string" ? query.format : "json").toLowerCase();
    const filter = parseFilter(query);

    if (format === "csv") {
      reply.header("content-type", "text/csv; charset=utf-8");
      reply.header("content-disposition", 'attachment; filename="audit-export.csv"');
      reply.raw.write(CSV_COLUMNS.join(",") + "\n");
      for await (const e of store.stream(filter)) {
        const row = [
          e.id, e.occurred_at, e.tenant_id, e.actor.id, e.actor.role, e.actor.ip,
          e.action, e.entity.type, e.entity.id, e.outcome, e.request_id, e.hash,
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
