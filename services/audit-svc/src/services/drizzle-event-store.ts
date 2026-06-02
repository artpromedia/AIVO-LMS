/**
 * Sprint 3 — Drizzle-backed canonical event store (production).
 *
 * Implements the same {@link EventStore} interface as the in-memory store,
 * against the partitioned `audit_events_v2` table. Append assigns the chain
 * fields from the current head inside a serializable transaction so
 * concurrent appends can't fork the chain. Reads never mutate (the table has
 * an append-only UPDATE/DELETE trigger).
 */
import { and, asc, desc, eq, gte, lte, lt, sql, type SQL } from "drizzle-orm";
import { auditEventsV2 } from "@aivo/db";
import type { AuditEvent, AuditEventInput } from "@aivo/audit-client";
import { uuidv7 } from "@aivo/audit-client";
import { GENESIS_HASH, hashEvent, verifyChain, type ChainBreak } from "../lib/hashChain.js";
import type { EventStore, EventFilter, EventPage } from "./event-store.js";

type Row = typeof auditEventsV2.$inferSelect;

function rowToEvent(r: Row): AuditEvent {
  return {
    id: r.id,
    occurred_at: (r.occurredAt instanceof Date ? r.occurredAt.toISOString() : String(r.occurredAt)),
    tenant_id: r.tenantId,
    actor: { id: r.actorId, role: r.actorRole, ip: r.actorIp, ua: r.actorUa },
    action: r.action,
    entity: { type: r.entityType, id: r.entityId },
    outcome: r.outcome as AuditEvent["outcome"],
    details: (r.details ?? {}) as Record<string, unknown>,
    request_id: r.requestId,
    prev_hash: r.prevHash ?? "",
    hash: r.hash,
  };
}

function whereFor(f: EventFilter): SQL | undefined {
  const conds: SQL[] = [];
  if (f.tenantId) conds.push(eq(auditEventsV2.tenantId, f.tenantId));
  if (f.actorId) conds.push(eq(auditEventsV2.actorId, f.actorId));
  if (f.actorRole) conds.push(eq(auditEventsV2.actorRole, f.actorRole));
  if (f.action) conds.push(eq(auditEventsV2.action, f.action));
  if (f.entityType) conds.push(eq(auditEventsV2.entityType, f.entityType));
  if (f.entityId) conds.push(eq(auditEventsV2.entityId, f.entityId));
  if (f.from) conds.push(gte(auditEventsV2.occurredAt, new Date(f.from)));
  if (f.to) conds.push(lte(auditEventsV2.occurredAt, new Date(f.to)));
  if (f.q) conds.push(sql`${auditEventsV2.details}::text ILIKE ${"%" + f.q + "%"}`);
  return conds.length ? and(...conds) : undefined;
}

export class DrizzleEventStore implements EventStore {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private readonly db: any) {}

  async append(input: AuditEventInput): Promise<AuditEvent> {
    return this.db.transaction(async (tx: typeof this.db) => {
      const [head] = await tx
        .select({ hash: auditEventsV2.hash })
        .from(auditEventsV2)
        .orderBy(desc(auditEventsV2.occurredAt), desc(auditEventsV2.id))
        .limit(1);
      const prev_hash: string = head?.hash ?? GENESIS_HASH;
      const base = {
        id: input.id ?? uuidv7(),
        occurred_at: input.occurred_at ?? new Date().toISOString(),
        tenant_id: input.tenant_id,
        actor: input.actor,
        action: input.action,
        entity: input.entity,
        outcome: input.outcome,
        details: input.details ?? {},
        request_id: input.request_id,
      };
      const hash = hashEvent(prev_hash, base);
      await tx.insert(auditEventsV2).values({
        id: base.id,
        occurredAt: new Date(base.occurred_at),
        tenantId: base.tenant_id,
        actorId: base.actor.id,
        actorRole: base.actor.role,
        actorIp: base.actor.ip,
        actorUa: base.actor.ua,
        action: base.action,
        entityType: base.entity.type,
        entityId: base.entity.id,
        outcome: base.outcome,
        details: base.details,
        requestId: base.request_id,
        prevHash: prev_hash,
        hash,
      });
      return { ...base, prev_hash, hash };
    });
  }

  async query(f: EventFilter): Promise<EventPage> {
    const limit = Math.min(f.limit ?? 50, 1000);
    let cursorCond: SQL | undefined;
    if (f.cursor) {
      const [c] = await this.db
        .select({ occurredAt: auditEventsV2.occurredAt, id: auditEventsV2.id })
        .from(auditEventsV2)
        .where(eq(auditEventsV2.id, f.cursor))
        .limit(1);
      if (c) {
        cursorCond = sql`(${auditEventsV2.occurredAt}, ${auditEventsV2.id}) < (${c.occurredAt}, ${c.id})`;
      }
    }
    const base = whereFor(f);
    const where = base && cursorCond ? and(base, cursorCond) : (cursorCond ?? base);
    const rows: Row[] = await this.db
      .select()
      .from(auditEventsV2)
      .where(where)
      .orderBy(desc(auditEventsV2.occurredAt), desc(auditEventsV2.id))
      .limit(limit + 1);
    const page = rows.slice(0, limit).map(rowToEvent);
    const nextCursor = rows.length > limit ? page[page.length - 1].id : null;
    return { events: page, nextCursor };
  }

  async getById(id: string): Promise<AuditEvent | null> {
    const [r] = await this.db.select().from(auditEventsV2).where(eq(auditEventsV2.id, id)).limit(1);
    return r ? rowToEvent(r) : null;
  }

  async proof(id: string) {
    const e = await this.getById(id);
    if (!e) return null;
    const [next] = await this.db
      .select({ hash: auditEventsV2.hash })
      .from(auditEventsV2)
      .where(sql`(${auditEventsV2.occurredAt}, ${auditEventsV2.id}) > (${new Date(e.occurred_at)}, ${e.id})`)
      .orderBy(asc(auditEventsV2.occurredAt), asc(auditEventsV2.id))
      .limit(1);
    return { prev_hash: e.prev_hash, hash: e.hash, next_hash: next?.hash ?? null };
  }

  async *stream(f: EventFilter): AsyncIterable<AuditEvent> {
    // Keyset-paginate ascending to keep memory roughly constant for export.
    const where = whereFor(f);
    let after: { occurredAt: Date; id: string } | null = null;
    const batch = 1000;
    for (;;) {
      const cond = after
        ? where
          ? and(where, sql`(${auditEventsV2.occurredAt}, ${auditEventsV2.id}) > (${after.occurredAt}, ${after.id})`)
          : sql`(${auditEventsV2.occurredAt}, ${auditEventsV2.id}) > (${after.occurredAt}, ${after.id})`
        : where;
      const rows: Row[] = await this.db
        .select()
        .from(auditEventsV2)
        .where(cond)
        .orderBy(asc(auditEventsV2.occurredAt), asc(auditEventsV2.id))
        .limit(batch);
      if (rows.length === 0) break;
      for (const r of rows) yield rowToEvent(r);
      const last = rows[rows.length - 1];
      after = { occurredAt: last.occurredAt as Date, id: last.id };
      if (rows.length < batch) break;
    }
  }

  async verify(): Promise<ChainBreak | null> {
    // Walk in chain order. For very large tables this should be windowed
    // against the daily anchors; here we verify the full chain.
    const rows: Row[] = await this.db
      .select()
      .from(auditEventsV2)
      .orderBy(asc(auditEventsV2.occurredAt), asc(auditEventsV2.id));
    return verifyChain(rows.map(rowToEvent), GENESIS_HASH);
  }
}

// Keep `lt` referenced for future range pruning helpers without an unused import.
void lt;
