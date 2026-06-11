/**
 * Sprint 3 — canonical audit event store (the `/events` surface).
 *
 * Append-only with hash chaining: `append` assigns `prev_hash`/`hash` from
 * the current chain head, so producers never compute the chain (no races).
 * The in-memory implementation stands in for the partitioned `audit_events`
 * table (migration 0048); the query/filter/export logic is identical so the
 * Drizzle-backed store is a thin swap.
 */
import { uuidv7, type AuditEvent, type AuditEventInput } from "@aivo/audit-client";
import { GENESIS_HASH, hashEvent, verifyChain, type ChainBreak } from "../lib/hashChain.js";

export interface EventFilter {
  tenantId?: string;
  actorId?: string;
  actorRole?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  from?: string; // ISO inclusive
  to?: string; // ISO inclusive
  q?: string; // free-text on canonical(details)
  limit?: number;
  cursor?: string; // event id to page after
}

export interface EventPage {
  events: AuditEvent[];
  nextCursor: string | null;
}

export interface VerifyRange {
  from?: string; // ISO inclusive
  to?: string; // ISO inclusive
}

export interface EventStore {
  append(input: AuditEventInput): Promise<AuditEvent>;
  query(filter: EventFilter): Promise<EventPage>;
  getById(id: string): Promise<AuditEvent | null>;
  /** Adjacent hashes for the single-event proof view. */
  proof(id: string): Promise<{ prev_hash: string; hash: string; next_hash: string | null } | null>;
  /** Async iterator for streaming export under a filter (no full buffering). */
  stream(filter: EventFilter): AsyncIterable<AuditEvent>;
  /**
   * Walk the chain (optionally only the slice covering `range`, anchored
   * against the event immediately before it) and report the first break.
   */
  verify(range?: VerifyRange): Promise<ChainBreak | null>;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 1000;

function matches(e: AuditEvent, f: EventFilter): boolean {
  if (f.tenantId && e.tenant_id !== f.tenantId) return false;
  if (f.actorId && e.actor.id !== f.actorId) return false;
  if (f.actorRole && e.actor.role !== f.actorRole) return false;
  if (f.action && e.action !== f.action) return false;
  if (f.entityType && e.entity.type !== f.entityType) return false;
  if (f.entityId && e.entity.id !== f.entityId) return false;
  if (f.from && e.occurred_at < f.from) return false;
  if (f.to && e.occurred_at > f.to) return false;
  if (f.q) {
    const hay = JSON.stringify(e.details).toLowerCase();
    if (!hay.includes(f.q.toLowerCase())) return false;
  }
  return true;
}

export class InMemoryEventStore implements EventStore {
  private events: AuditEvent[] = [];
  private headHash = GENESIS_HASH;

  async append(input: AuditEventInput): Promise<AuditEvent> {
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
    const prev_hash = this.headHash;
    const hash = hashEvent(prev_hash, base);
    const event: AuditEvent = { ...base, prev_hash, hash };
    this.events.push(event);
    this.headHash = hash;
    return event;
  }

  private filtered(filter: EventFilter): AuditEvent[] {
    // Newest first for queries; the chain itself is stored oldest→newest.
    return this.events
      .filter((e) => matches(e, filter))
      .slice()
      .reverse();
  }

  async query(filter: EventFilter): Promise<EventPage> {
    const limit = Math.min(filter.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const all = this.filtered(filter);
    const start = filter.cursor ? all.findIndex((e) => e.id === filter.cursor) + 1 : 0;
    const page = all.slice(start, start + limit);
    const nextCursor = start + limit < all.length ? (page[page.length - 1]?.id ?? null) : null;
    return { events: page, nextCursor };
  }

  async getById(id: string): Promise<AuditEvent | null> {
    return this.events.find((e) => e.id === id) ?? null;
  }

  async proof(id: string) {
    const idx = this.events.findIndex((e) => e.id === id);
    if (idx === -1) return null;
    const e = this.events[idx];
    const next = this.events[idx + 1];
    return { prev_hash: e.prev_hash, hash: e.hash, next_hash: next ? next.hash : null };
  }

  async *stream(filter: EventFilter): AsyncIterable<AuditEvent> {
    for (const e of this.filtered(filter)) {
      if (matches(e, filter)) yield e;
    }
  }

  async verify(range?: VerifyRange): Promise<ChainBreak | null> {
    if (!range?.from && !range?.to) {
      return verifyChain(this.events, GENESIS_HASH);
    }
    // The events array IS chain order; take the contiguous span covering
    // the range and anchor it on the event immediately before the span.
    let first = -1;
    let last = -1;
    for (let i = 0; i < this.events.length; i++) {
      const at = this.events[i].occurred_at;
      if (range.from && at < range.from) continue;
      if (range.to && at > range.to) continue;
      if (first === -1) first = i;
      last = i;
    }
    if (first === -1) return null; // empty range = nothing to dispute
    const anchor = first > 0 ? this.events[first - 1].hash : GENESIS_HASH;
    return verifyChain(this.events.slice(first, last + 1), anchor);
  }

  /** Test-only: tamper with a stored event to exercise the verifier. */
  _tamper(id: string, mutate: (e: AuditEvent) => void): void {
    const e = this.events.find((x) => x.id === id);
    if (e) mutate(e);
  }
}
