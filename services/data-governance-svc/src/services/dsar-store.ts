/**
 * DSAR request + timeline store (Sprint 5).
 *
 * Follows the same DB-or-fallback pattern as `dpa-store.ts`: an in-memory
 * implementation for tests / local dev (no DATABASE_URL) and a Postgres
 * implementation (Drizzle against the `dsar_requests` / `dsar_events` tables
 * in `@aivo/db`) for production. `selectDsarStore()` enforces that production
 * uses Postgres so requests survive restart and remain auditable. All SLA
 * math is delegated to `domain/sla.ts` so deadlines are computed in exactly
 * one place.
 */
import { randomUUID } from "node:crypto";
import { dsarRequests, dsarEvents } from "@aivo/db";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import {
  computeDeadlines,
  evaluateSla,
  resolveSlaConfig,
  type Regulation,
  type SlaConfig,
  type SlaStatus,
} from "../domain/sla.js";

export type DsarType =
  | "access"
  | "erasure"
  | "portability"
  | "rectification"
  | "restriction"
  | "objection";

export type DsarStatus =
  | "intake"
  | "identity_verification"
  | "assigned"
  | "approved"
  | "fulfilling"
  | "fulfilled"
  | "rejected";

export interface DsarEvent {
  id: string;
  dsarId: string;
  eventType: string;
  actorId?: string | null;
  actorRole?: string | null;
  detail?: Record<string, unknown>;
  createdAt: string;
}

export interface DsarRequest {
  id: string;
  tenantId: string | null;
  type: DsarType;
  regulation: Regulation;
  subjectId: string;
  subjectType: string;
  subjectEmail: string | null;
  requesterId: string | null;
  requesterRole: string | null;
  onBehalfOfMinor: boolean;
  status: DsarStatus;
  identityVerified: boolean;
  verificationMethod: string | null;
  assigneeId: string | null;
  evidence: Array<Record<string, unknown>>;
  notes: string | null;
  ackDueAt: string;
  fulfillmentDueAt: string;
  acknowledgedAt: string | null;
  fulfilledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDsarInput {
  tenantId?: string | null;
  type: DsarType;
  regulations?: Regulation[];
  subjectId: string;
  subjectType?: string;
  subjectEmail?: string | null;
  requesterId?: string | null;
  requesterRole?: string | null;
  onBehalfOfMinor?: boolean;
  slaOverride?: Partial<SlaConfig>;
}

export interface ListDsarFilter {
  status?: DsarStatus;
  tenantId?: string | null;
  /** Restrict to these tenant ids (district scoping). undefined = all. */
  tenantScope?: string[];
}

interface Actor {
  actorId?: string | null;
  actorRole?: string | null;
}

/** Build a fresh DSAR record from intake input. Shared by both stores so the
 *  computed shape (deadlines, defaults) is identical regardless of backend. */
function buildDsarRecord(input: CreateDsarInput): DsarRequest {
  const regulations = input.regulations ?? ["gdpr"];
  const config = resolveSlaConfig(regulations, input.slaOverride);
  const now = new Date();
  const deadlines = computeDeadlines(now, config);
  return {
    id: randomUUID(),
    tenantId: input.tenantId ?? null,
    type: input.type,
    regulation: regulations[0],
    subjectId: input.subjectId,
    subjectType: input.subjectType ?? "learner",
    subjectEmail: input.subjectEmail ?? null,
    requesterId: input.requesterId ?? null,
    requesterRole: input.requesterRole ?? null,
    onBehalfOfMinor: input.onBehalfOfMinor ?? false,
    status: "intake",
    identityVerified: false,
    verificationMethod: null,
    assigneeId: null,
    evidence: [],
    notes: null,
    ackDueAt: deadlines.ackDueAt,
    fulfillmentDueAt: deadlines.fulfillmentDueAt,
    acknowledgedAt: null,
    fulfilledAt: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

/**
 * Common interface so the routes don't need to know whether they're talking
 * to in-memory state (tests / local dev) or PostgreSQL (production). Same
 * shape, same return values. Methods may return a value or a Promise.
 */
export interface DsarStore {
  createDsar(input: CreateDsarInput): Promise<DsarRequest> | DsarRequest;
  getDsar(id: string): Promise<DsarRequest | undefined> | DsarRequest | undefined;
  getTimeline(id: string): Promise<DsarEvent[]> | DsarEvent[];
  listDsars(filter?: ListDsarFilter): Promise<DsarRequest[]> | DsarRequest[];
  verifyIdentity(
    id: string,
    method: string,
    actor?: Actor,
  ): Promise<DsarRequest | undefined> | DsarRequest | undefined;
  assignDsar(
    id: string,
    assigneeId: string,
    actor?: Actor,
  ): Promise<DsarRequest | undefined> | DsarRequest | undefined;
  approveDsar(id: string, actor?: Actor): Promise<DsarRequest | undefined> | DsarRequest | undefined;
  rejectDsar(
    id: string,
    reason: string,
    actor?: Actor,
  ): Promise<DsarRequest | undefined> | DsarRequest | undefined;
  startFulfillment(
    id: string,
    actor?: Actor,
  ): Promise<DsarRequest | undefined> | DsarRequest | undefined;
  recordServiceResponse(
    id: string,
    detail: Record<string, unknown>,
  ): Promise<DsarRequest | undefined> | DsarRequest | undefined;
  fulfillDsar(
    id: string,
    evidence: Record<string, unknown>,
    actor?: Actor,
  ): Promise<DsarRequest | undefined> | DsarRequest | undefined;
}

/**
 * In-memory implementation. Used by unit tests and local dev when no
 * DATABASE_URL is configured. Production MUST inject the Postgres
 * implementation below — `selectDsarStore()` enforces this.
 */
export class InMemoryDsarStore implements DsarStore {
  private requests = new Map<string, DsarRequest>();
  private events = new Map<string, DsarEvent[]>();

  /** Reset all state. Used by `clearDsarStoreForTest()`. */
  clear(): void {
    this.requests.clear();
    this.events.clear();
  }

  private appendEvent(
    dsarId: string,
    eventType: string,
    actor?: Actor,
    detail?: Record<string, unknown>,
  ): DsarEvent {
    const ev: DsarEvent = {
      id: randomUUID(),
      dsarId,
      eventType,
      actorId: actor?.actorId ?? null,
      actorRole: actor?.actorRole ?? null,
      detail: detail ?? {},
      createdAt: new Date().toISOString(),
    };
    const list = this.events.get(dsarId) ?? [];
    list.push(ev);
    this.events.set(dsarId, list);
    return ev;
  }

  private update(id: string, patch: Partial<DsarRequest>): DsarRequest | undefined {
    const existing = this.requests.get(id);
    if (!existing) return undefined;
    const next = { ...existing, ...patch, updatedAt: new Date().toISOString() };
    this.requests.set(id, next);
    return next;
  }

  createDsar(input: CreateDsarInput): DsarRequest {
    const record = buildDsarRecord(input);
    this.requests.set(record.id, record);
    this.appendEvent(
      record.id,
      "created",
      { actorId: input.requesterId, actorRole: input.requesterRole },
      {
        type: input.type,
        regulation: record.regulation,
        onBehalfOfMinor: record.onBehalfOfMinor,
      },
    );
    return record;
  }

  getDsar(id: string): DsarRequest | undefined {
    return this.requests.get(id);
  }

  getTimeline(id: string): DsarEvent[] {
    return [...(this.events.get(id) ?? [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  listDsars(filter: ListDsarFilter = {}): DsarRequest[] {
    return Array.from(this.requests.values())
      .filter((r) => (filter.status ? r.status === filter.status : true))
      .filter((r) => (filter.tenantId !== undefined ? r.tenantId === filter.tenantId : true))
      .filter((r) =>
        filter.tenantScope ? r.tenantId !== null && filter.tenantScope.includes(r.tenantId) : true,
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  verifyIdentity(id: string, method: string, actor?: Actor): DsarRequest | undefined {
    const next = this.update(id, {
      identityVerified: true,
      verificationMethod: method,
      acknowledgedAt: new Date().toISOString(),
      status: "identity_verification",
    });
    if (next) this.appendEvent(id, "identity_verified", actor, { method });
    return next;
  }

  assignDsar(id: string, assigneeId: string, actor?: Actor): DsarRequest | undefined {
    const next = this.update(id, { assigneeId, status: "assigned" });
    if (next) this.appendEvent(id, "assigned", actor, { assigneeId });
    return next;
  }

  approveDsar(id: string, actor?: Actor): DsarRequest | undefined {
    const next = this.update(id, { status: "approved" });
    if (next) this.appendEvent(id, "approved", actor);
    return next;
  }

  rejectDsar(id: string, reason: string, actor?: Actor): DsarRequest | undefined {
    const next = this.update(id, { status: "rejected", notes: reason });
    if (next) this.appendEvent(id, "rejected", actor, { reason });
    return next;
  }

  startFulfillment(id: string, actor?: Actor): DsarRequest | undefined {
    const next = this.update(id, { status: "fulfilling" });
    if (next) this.appendEvent(id, "fulfillment_started", actor);
    return next;
  }

  recordServiceResponse(id: string, detail: Record<string, unknown>): DsarRequest | undefined {
    const existing = this.requests.get(id);
    if (!existing) return undefined;
    this.appendEvent(id, "service_responded", undefined, detail);
    return existing;
  }

  fulfillDsar(
    id: string,
    evidence: Record<string, unknown>,
    actor?: Actor,
  ): DsarRequest | undefined {
    const existing = this.requests.get(id);
    if (!existing) return undefined;
    const next = this.update(id, {
      status: "fulfilled",
      fulfilledAt: new Date().toISOString(),
      evidence: [...existing.evidence, evidence],
    });
    if (next) this.appendEvent(id, "fulfilled", actor, evidence);
    return next;
  }
}

function isoOrThrow(d: Date): string {
  return d.toISOString();
}

function isoOrNull(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

function rowToRequest(row: typeof dsarRequests.$inferSelect): DsarRequest {
  return {
    id: row.id,
    tenantId: row.tenantId,
    type: row.type as DsarType,
    regulation: row.regulation as Regulation,
    subjectId: row.subjectId,
    subjectType: row.subjectType,
    subjectEmail: row.subjectEmail,
    requesterId: row.requesterId,
    requesterRole: row.requesterRole,
    onBehalfOfMinor: row.onBehalfOfMinor,
    status: row.status as DsarStatus,
    identityVerified: row.identityVerified,
    verificationMethod: row.verificationMethod,
    assigneeId: row.assigneeId,
    evidence: (row.evidence as Array<Record<string, unknown>>) ?? [],
    notes: row.notes,
    // ackDueAt / fulfillmentDueAt are nullable in the table but always set at
    // intake; fall back to created_at so the DTO's non-null contract holds.
    ackDueAt: isoOrNull(row.ackDueAt) ?? isoOrThrow(row.createdAt),
    fulfillmentDueAt: isoOrNull(row.fulfillmentDueAt) ?? isoOrThrow(row.createdAt),
    acknowledgedAt: isoOrNull(row.acknowledgedAt),
    fulfilledAt: isoOrNull(row.fulfilledAt),
    createdAt: isoOrThrow(row.createdAt),
    updatedAt: isoOrThrow(row.updatedAt),
  };
}

function rowToEvent(row: typeof dsarEvents.$inferSelect): DsarEvent {
  return {
    id: row.id,
    dsarId: row.dsarId,
    eventType: row.eventType,
    actorId: row.actorId,
    actorRole: row.actorRole,
    detail: (row.detail as Record<string, unknown>) ?? {},
    createdAt: isoOrThrow(row.createdAt),
  };
}

/**
 * PostgreSQL-backed implementation. Writes to / reads from the shared
 * `dsar_requests` / `dsar_events` tables declared in `@aivo/db`. Records
 * survive restart, scale horizontally, and remain queryable for compliance
 * audits — the in-memory store provides none of those.
 */
export class PostgresDsarStore implements DsarStore {
  // `db` is a drizzle client (`createDb(DATABASE_URL)` from @aivo/db).
  // Typed as `any` to keep this file dependency-light.
  constructor(private readonly db: any) {}

  private async appendEvent(
    dsarId: string,
    eventType: string,
    actor?: Actor,
    detail?: Record<string, unknown>,
  ): Promise<void> {
    await this.db.insert(dsarEvents).values({
      dsarId,
      eventType,
      actorId: actor?.actorId ?? null,
      actorRole: actor?.actorRole ?? null,
      detail: detail ?? {},
    });
  }

  private async update(
    id: string,
    patch: Record<string, unknown>,
  ): Promise<DsarRequest | undefined> {
    const [row] = await this.db
      .update(dsarRequests)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(dsarRequests.id, id))
      .returning();
    return row ? rowToRequest(row) : undefined;
  }

  async createDsar(input: CreateDsarInput): Promise<DsarRequest> {
    const record = buildDsarRecord(input);
    const [row] = await this.db
      .insert(dsarRequests)
      .values({
        id: record.id,
        tenantId: record.tenantId,
        type: record.type,
        regulation: record.regulation,
        subjectId: record.subjectId,
        subjectType: record.subjectType,
        subjectEmail: record.subjectEmail,
        requesterId: record.requesterId,
        requesterRole: record.requesterRole,
        onBehalfOfMinor: record.onBehalfOfMinor,
        status: record.status,
        identityVerified: record.identityVerified,
        verificationMethod: record.verificationMethod,
        assigneeId: record.assigneeId,
        evidence: record.evidence,
        notes: record.notes,
        ackDueAt: new Date(record.ackDueAt),
        fulfillmentDueAt: new Date(record.fulfillmentDueAt),
        acknowledgedAt: record.acknowledgedAt ? new Date(record.acknowledgedAt) : null,
        fulfilledAt: record.fulfilledAt ? new Date(record.fulfilledAt) : null,
        createdAt: new Date(record.createdAt),
        updatedAt: new Date(record.updatedAt),
      })
      .returning();
    const created = rowToRequest(row);
    await this.appendEvent(
      created.id,
      "created",
      { actorId: input.requesterId, actorRole: input.requesterRole },
      {
        type: input.type,
        regulation: created.regulation,
        onBehalfOfMinor: created.onBehalfOfMinor,
      },
    );
    return created;
  }

  async getDsar(id: string): Promise<DsarRequest | undefined> {
    const rows = await this.db
      .select()
      .from(dsarRequests)
      .where(eq(dsarRequests.id, id))
      .limit(1);
    return rows[0] ? rowToRequest(rows[0]) : undefined;
  }

  async getTimeline(id: string): Promise<DsarEvent[]> {
    const rows = await this.db
      .select()
      .from(dsarEvents)
      .where(eq(dsarEvents.dsarId, id))
      .orderBy(asc(dsarEvents.createdAt));
    return rows.map(rowToEvent);
  }

  async listDsars(filter: ListDsarFilter = {}): Promise<DsarRequest[]> {
    const conditions = [];
    if (filter.status) conditions.push(eq(dsarRequests.status, filter.status));
    if (filter.tenantId !== undefined) {
      conditions.push(eq(dsarRequests.tenantId, filter.tenantId as any));
    }
    if (filter.tenantScope) {
      // Empty scope matches nothing; otherwise restrict to the given tenants.
      if (filter.tenantScope.length === 0) return [];
      conditions.push(inArray(dsarRequests.tenantId, filter.tenantScope));
    }
    const rows = await this.db
      .select()
      .from(dsarRequests)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(dsarRequests.createdAt));
    return rows.map(rowToRequest);
  }

  async verifyIdentity(
    id: string,
    method: string,
    actor?: Actor,
  ): Promise<DsarRequest | undefined> {
    const next = await this.update(id, {
      identityVerified: true,
      verificationMethod: method,
      acknowledgedAt: new Date(),
      status: "identity_verification",
    });
    if (next) await this.appendEvent(id, "identity_verified", actor, { method });
    return next;
  }

  async assignDsar(
    id: string,
    assigneeId: string,
    actor?: Actor,
  ): Promise<DsarRequest | undefined> {
    const next = await this.update(id, { assigneeId, status: "assigned" });
    if (next) await this.appendEvent(id, "assigned", actor, { assigneeId });
    return next;
  }

  async approveDsar(id: string, actor?: Actor): Promise<DsarRequest | undefined> {
    const next = await this.update(id, { status: "approved" });
    if (next) await this.appendEvent(id, "approved", actor);
    return next;
  }

  async rejectDsar(id: string, reason: string, actor?: Actor): Promise<DsarRequest | undefined> {
    const next = await this.update(id, { status: "rejected", notes: reason });
    if (next) await this.appendEvent(id, "rejected", actor, { reason });
    return next;
  }

  async startFulfillment(id: string, actor?: Actor): Promise<DsarRequest | undefined> {
    const next = await this.update(id, { status: "fulfilling" });
    if (next) await this.appendEvent(id, "fulfillment_started", actor);
    return next;
  }

  async recordServiceResponse(
    id: string,
    detail: Record<string, unknown>,
  ): Promise<DsarRequest | undefined> {
    const existing = await this.getDsar(id);
    if (!existing) return undefined;
    await this.appendEvent(id, "service_responded", undefined, detail);
    return existing;
  }

  async fulfillDsar(
    id: string,
    evidence: Record<string, unknown>,
    actor?: Actor,
  ): Promise<DsarRequest | undefined> {
    const existing = await this.getDsar(id);
    if (!existing) return undefined;
    const next = await this.update(id, {
      status: "fulfilled",
      fulfilledAt: new Date(),
      evidence: [...existing.evidence, evidence],
    });
    if (next) await this.appendEvent(id, "fulfilled", actor, evidence);
    return next;
  }
}

/**
 * Pick the right store at boot. Production requires `DATABASE_URL` (and a
 * drizzle client constructed from `@aivo/db.createDb`) so DSAR records are
 * never lost on restart. Non-production tolerates the in-memory store.
 */
export function selectDsarStore(db: any | null | undefined): DsarStore {
  if (db) return new PostgresDsarStore(db);
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "data-governance-svc: DATABASE_URL / drizzle client required in production. " +
        "InMemoryDsarStore must NOT be used in production — DSAR records would be " +
        "lost on restart, breaking compliance audits.",
    );
  }
  return new InMemoryDsarStore();
}

// Default store: in-memory for tests / local dev. Production replaces this via
// `initDsarStoreFromDb(...)` at boot with a PostgresDsarStore.
let STORE: DsarStore = new InMemoryDsarStore();

/** Initialize the store from a (possibly absent) drizzle client.
 *  In production with no client, throws — DSAR records must persist. */
export function initDsarStoreFromDb(db: any | null | undefined): void {
  STORE = selectDsarStore(db);
}

/** Clears the in-memory singleton's state. Used by tests. */
export function clearDsarStoreForTest(): void {
  if (STORE instanceof InMemoryDsarStore) {
    STORE.clear();
  } else {
    STORE = new InMemoryDsarStore();
  }
}

// ── Free functions: delegate to the active store ─────────────────────────────

export async function createDsar(input: CreateDsarInput): Promise<DsarRequest> {
  return STORE.createDsar(input);
}

export async function getDsar(id: string): Promise<DsarRequest | undefined> {
  return STORE.getDsar(id);
}

export async function getTimeline(id: string): Promise<DsarEvent[]> {
  return STORE.getTimeline(id);
}

export async function listDsars(filter: ListDsarFilter = {}): Promise<DsarRequest[]> {
  return STORE.listDsars(filter);
}

export async function verifyIdentity(
  id: string,
  method: string,
  actor?: Actor,
): Promise<DsarRequest | undefined> {
  return STORE.verifyIdentity(id, method, actor);
}

export async function assignDsar(
  id: string,
  assigneeId: string,
  actor?: Actor,
): Promise<DsarRequest | undefined> {
  return STORE.assignDsar(id, assigneeId, actor);
}

export async function approveDsar(id: string, actor?: Actor): Promise<DsarRequest | undefined> {
  return STORE.approveDsar(id, actor);
}

export async function rejectDsar(
  id: string,
  reason: string,
  actor?: Actor,
): Promise<DsarRequest | undefined> {
  return STORE.rejectDsar(id, reason, actor);
}

export async function startFulfillment(
  id: string,
  actor?: Actor,
): Promise<DsarRequest | undefined> {
  return STORE.startFulfillment(id, actor);
}

export async function recordServiceResponse(
  id: string,
  detail: Record<string, unknown>,
): Promise<DsarRequest | undefined> {
  return STORE.recordServiceResponse(id, detail);
}

export async function fulfillDsar(
  id: string,
  evidence: Record<string, unknown>,
  actor?: Actor,
): Promise<DsarRequest | undefined> {
  return STORE.fulfillDsar(id, evidence, actor);
}

/** Live SLA status for a request, for the queue timers + overdue banners. */
export function slaStatusFor(r: DsarRequest, now: Date = new Date()): SlaStatus {
  return evaluateSla({
    deadlines: { ackDueAt: r.ackDueAt, fulfillmentDueAt: r.fulfillmentDueAt },
    now,
    acknowledgedAt: r.acknowledgedAt,
    fulfilledAt: r.fulfilledAt,
  });
}

export interface DsarKpis {
  open: number;
  overdue: number;
  fulfilled: number;
  avgFulfillmentHours: number | null;
}

export function computeKpis(list: DsarRequest[], now: Date = new Date()): DsarKpis {
  const terminal = new Set<DsarStatus>(["fulfilled", "rejected"]);
  const open = list.filter((r) => !terminal.has(r.status)).length;
  const overdue = list.filter(
    (r) => !terminal.has(r.status) && slaStatusFor(r, now).state === "overdue",
  ).length;
  const fulfilledList = list.filter((r) => r.status === "fulfilled" && r.fulfilledAt);
  const fulfilled = fulfilledList.length;
  const avgFulfillmentHours =
    fulfilled === 0
      ? null
      : Math.round(
          fulfilledList.reduce(
            (sum, r) =>
              sum +
              (new Date(r.fulfilledAt!).getTime() - new Date(r.createdAt).getTime()) / 3_600_000,
            0,
          ) / fulfilled,
        );
  return { open, overdue, fulfilled, avgFulfillmentHours };
}
