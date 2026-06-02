/**
 * DSAR request + timeline store (Sprint 5).
 *
 * In-memory implementation following the precedent set by
 * `routes/deletion-requests.ts` (a process-local Map): enough for local
 * dev, the e2e flow, and the admin console. Production wiring to the
 * Postgres `dsar_requests` / `dsar_events` tables follows the same
 * DB-or-fallback pattern as `dpa-store.ts`. All SLA math is delegated to
 * `domain/sla.ts` so deadlines are computed in exactly one place.
 */
import { randomUUID } from "node:crypto";
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

const requests = new Map<string, DsarRequest>();
const events = new Map<string, DsarEvent[]>();

export function clearDsarStoreForTest(): void {
  requests.clear();
  events.clear();
}

function appendEvent(
  dsarId: string,
  eventType: string,
  actor?: { actorId?: string | null; actorRole?: string | null },
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
  const list = events.get(dsarId) ?? [];
  list.push(ev);
  events.set(dsarId, list);
  return ev;
}

export function createDsar(input: CreateDsarInput): DsarRequest {
  const regulations = input.regulations ?? ["gdpr"];
  const config = resolveSlaConfig(regulations, input.slaOverride);
  const now = new Date();
  const deadlines = computeDeadlines(now, config);
  const id = randomUUID();
  const record: DsarRequest = {
    id,
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
  requests.set(id, record);
  appendEvent(
    id,
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

export function getDsar(id: string): DsarRequest | undefined {
  return requests.get(id);
}

export function getTimeline(id: string): DsarEvent[] {
  return [...(events.get(id) ?? [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export interface ListDsarFilter {
  status?: DsarStatus;
  tenantId?: string | null;
  /** Restrict to these tenant ids (district scoping). undefined = all. */
  tenantScope?: string[];
}

export function listDsars(filter: ListDsarFilter = {}): DsarRequest[] {
  return Array.from(requests.values())
    .filter((r) => (filter.status ? r.status === filter.status : true))
    .filter((r) => (filter.tenantId !== undefined ? r.tenantId === filter.tenantId : true))
    .filter((r) =>
      filter.tenantScope ? r.tenantId !== null && filter.tenantScope.includes(r.tenantId) : true,
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function update(id: string, patch: Partial<DsarRequest>): DsarRequest | undefined {
  const existing = requests.get(id);
  if (!existing) return undefined;
  const next = { ...existing, ...patch, updatedAt: new Date().toISOString() };
  requests.set(id, next);
  return next;
}

export function verifyIdentity(
  id: string,
  method: string,
  actor?: { actorId?: string | null; actorRole?: string | null },
): DsarRequest | undefined {
  const next = update(id, {
    identityVerified: true,
    verificationMethod: method,
    acknowledgedAt: new Date().toISOString(),
    status: "identity_verification",
  });
  if (next) appendEvent(id, "identity_verified", actor, { method });
  return next;
}

export function assignDsar(
  id: string,
  assigneeId: string,
  actor?: { actorId?: string | null; actorRole?: string | null },
): DsarRequest | undefined {
  const next = update(id, { assigneeId, status: "assigned" });
  if (next) appendEvent(id, "assigned", actor, { assigneeId });
  return next;
}

export function approveDsar(
  id: string,
  actor?: { actorId?: string | null; actorRole?: string | null },
): DsarRequest | undefined {
  const next = update(id, { status: "approved" });
  if (next) appendEvent(id, "approved", actor);
  return next;
}

export function rejectDsar(
  id: string,
  reason: string,
  actor?: { actorId?: string | null; actorRole?: string | null },
): DsarRequest | undefined {
  const next = update(id, { status: "rejected", notes: reason });
  if (next) appendEvent(id, "rejected", actor, { reason });
  return next;
}

export function startFulfillment(
  id: string,
  actor?: { actorId?: string | null; actorRole?: string | null },
): DsarRequest | undefined {
  const next = update(id, { status: "fulfilling" });
  if (next) appendEvent(id, "fulfillment_started", actor);
  return next;
}

export function recordServiceResponse(
  id: string,
  detail: Record<string, unknown>,
): DsarRequest | undefined {
  const existing = requests.get(id);
  if (!existing) return undefined;
  appendEvent(id, "service_responded", undefined, detail);
  return existing;
}

export function fulfillDsar(
  id: string,
  evidence: Record<string, unknown>,
  actor?: { actorId?: string | null; actorRole?: string | null },
): DsarRequest | undefined {
  const existing = requests.get(id);
  if (!existing) return undefined;
  const next = update(id, {
    status: "fulfilled",
    fulfilledAt: new Date().toISOString(),
    evidence: [...existing.evidence, evidence],
  });
  if (next) appendEvent(id, "fulfilled", actor, evidence);
  return next;
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
