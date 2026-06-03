/**
 * Compliance-console data layer for the web BFF/pages (Sprint 5).
 *
 * Self-contained, in-memory, seeded once — layered on top of the existing
 * mock repo like `lib/billing/district-pool.ts`. Mirrors the canonical
 * backend (`services/data-governance-svc`) shapes and SLA/retention math
 * (ADR 0034) so the UI behaves the same as production. The module-level
 * Maps are a singleton within the Next.js server process, so a mutation in
 * one request (e.g. fulfilling a DSAR) is visible to the next read — what
 * the cross-step e2e relies on.
 */
import { getTenantById, scopeTenantsForSession } from "@/lib/db/repos";
import type { Role } from "@/lib/auth/types";

// ── SLA math (mirrors services/data-governance-svc/src/domain/sla.ts) ────────

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
export const ACK_HOURS = 72;
export const REGULATION_FULFILLMENT_DAYS = { gdpr: 30, ccpa: 45, ferpa: 45 } as const;
export type Regulation = keyof typeof REGULATION_FULFILLMENT_DAYS;

export type SlaState = "on_track" | "due_soon" | "overdue" | "met";

export function evaluateSla(args: {
  createdAt: string;
  fulfillmentDays: number;
  now?: Date;
  acknowledgedAt?: string | null;
  fulfilledAt?: string | null;
}): { state: SlaState; ackOverdue: boolean; fulfillmentRemainingMs: number } {
  const start = new Date(args.createdAt).getTime();
  const now = (args.now ?? new Date()).getTime();
  const ackDue = start + ACK_HOURS * HOUR_MS;
  const fulfillDue = start + args.fulfillmentDays * DAY_MS;
  const acknowledged = args.acknowledgedAt ? new Date(args.acknowledgedAt).getTime() : null;
  const fulfilled = args.fulfilledAt ? new Date(args.fulfilledAt).getTime() : null;
  const ackOverdue = acknowledged === null && now > ackDue;
  if (fulfilled !== null) {
    return { state: "met", ackOverdue, fulfillmentRemainingMs: fulfillDue - fulfilled };
  }
  const remaining = fulfillDue - now;
  let state: SlaState;
  if (remaining < 0) state = "overdue";
  else if (remaining <= 3 * DAY_MS) state = "due_soon";
  else state = "on_track";
  return { state, ackOverdue, fulfillmentRemainingMs: remaining };
}

export function formatRemaining(ms: number): string {
  const overdue = ms < 0;
  const abs = Math.abs(ms);
  const days = Math.floor(abs / DAY_MS);
  const hours = Math.floor((abs % DAY_MS) / HOUR_MS);
  const core = days > 0 ? `${days}d ${hours}h` : `${hours}h`;
  return overdue ? `overdue ${core}` : core;
}

// ── Types ────────────────────────────────────────────────────────────────────

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
  eventType: string;
  actorRole: string | null;
  detail: Record<string, unknown>;
  createdAt: string;
}

export interface Dsar {
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
  assigneeId: string | null;
  evidence: Array<Record<string, unknown>>;
  fulfillmentDays: number;
  acknowledgedAt: string | null;
  fulfilledAt: string | null;
  createdAt: string;
  updatedAt: string;
  events: DsarEvent[];
}

export interface ConsentRecord {
  id: string;
  tenantId: string | null;
  subjectId: string;
  consentType: string;
  granted: boolean;
  actorRole: string | null;
  method: string | null;
  createdAt: string;
}

export type Disposition = "purge" | "anonymize";
export type Sensitivity = "low" | "moderate" | "high" | "restricted";

export interface DataClass {
  dataClass: string;
  owningService: string;
  sensitivity: Sensitivity;
  description: string;
  defaultRetentionDays: number | null;
  erasable: boolean;
}

export interface RetentionPolicy {
  dataClass: string;
  retentionDays: number | null;
  disposition: Disposition;
  legalHold: boolean;
  updatedAt: string;
}

// ── Seed catalog (mirrors the backend catalog-store) ─────────────────────────

export const DATA_CATALOG: DataClass[] = [
  {
    dataClass: "identity_profile",
    owningService: "identity-svc",
    sensitivity: "restricted",
    description: "Name, email, DOB, login identifiers.",
    defaultRetentionDays: null,
    erasable: true,
  },
  {
    dataClass: "auth_sessions",
    owningService: "identity-svc",
    sensitivity: "high",
    description: "Session tokens and login history.",
    defaultRetentionDays: 90,
    erasable: true,
  },
  {
    dataClass: "tenant_membership",
    owningService: "tenant-svc",
    sensitivity: "moderate",
    description: "School/district enrollment and roles.",
    defaultRetentionDays: null,
    erasable: true,
  },
  {
    dataClass: "billing_records",
    owningService: "billing-svc",
    sensitivity: "high",
    description: "Invoices, subscriptions, payment metadata.",
    defaultRetentionDays: 2555,
    erasable: false,
  },
  {
    dataClass: "assessment_scores",
    owningService: "learning-svc",
    sensitivity: "restricted",
    description: "FERPA education records — assessments.",
    defaultRetentionDays: 1825,
    erasable: true,
  },
  {
    dataClass: "lesson_activity",
    owningService: "learning-svc",
    sensitivity: "high",
    description: "Lesson runs, mastery, engagement.",
    defaultRetentionDays: 1095,
    erasable: true,
  },
  {
    dataClass: "chat_logs",
    owningService: "learning-svc",
    sensitivity: "high",
    description: "Tutor/homework transcripts.",
    defaultRetentionDays: 365,
    erasable: true,
  },
  {
    dataClass: "integration_rostering",
    owningService: "integration-svc",
    sensitivity: "moderate",
    description: "SIS/LMS roster sync + external IDs.",
    defaultRetentionDays: 365,
    erasable: true,
  },
  {
    dataClass: "admin_actions",
    owningService: "admin-svc",
    sensitivity: "moderate",
    description: "Admin operations attributable to a subject.",
    defaultRetentionDays: 1095,
    erasable: true,
  },
  {
    dataClass: "audit_events",
    owningService: "audit-svc",
    sensitivity: "high",
    description: "Hash-chained audit trail; anonymized on erasure.",
    defaultRetentionDays: 2555,
    erasable: false,
  },
];

// ── Stores ───────────────────────────────────────────────────────────────────

const dsars = new Map<string, Dsar>();
const consents: ConsentRecord[] = [];
const policies = new Map<string, RetentionPolicy>();
let seeded = false;

function fulfillmentDaysFor(reg: Regulation): number {
  return REGULATION_FULFILLMENT_DAYS[reg];
}

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function addEvent(
  d: Dsar,
  eventType: string,
  actorRole: string | null,
  detail: Record<string, unknown> = {},
): void {
  d.events.push({
    id: newId("ev"),
    eventType,
    actorRole,
    detail,
    createdAt: new Date().toISOString(),
  });
  d.updatedAt = new Date().toISOString();
}

function seed(): void {
  if (seeded) return;
  seeded = true;
  const now = Date.now();
  const mk = (over: Partial<Dsar>): Dsar => {
    const createdAt = over.createdAt ?? new Date(now - 5 * DAY_MS).toISOString();
    const regulation = over.regulation ?? "gdpr";
    const base: Dsar = {
      id: over.id ?? newId("dsar"),
      tenantId: over.tenantId ?? "t_district_demo",
      type: over.type ?? "access",
      regulation,
      subjectId: over.subjectId ?? "lrn_demo_sky",
      subjectType: over.subjectType ?? "learner",
      subjectEmail: over.subjectEmail ?? null,
      requesterId: over.requesterId ?? "u_parent_1",
      requesterRole: over.requesterRole ?? "parent",
      onBehalfOfMinor: over.onBehalfOfMinor ?? true,
      status: over.status ?? "intake",
      identityVerified: over.identityVerified ?? false,
      assigneeId: over.assigneeId ?? null,
      evidence: over.evidence ?? [],
      fulfillmentDays: fulfillmentDaysFor(regulation),
      acknowledgedAt: over.acknowledgedAt ?? null,
      fulfilledAt: over.fulfilledAt ?? null,
      createdAt,
      updatedAt: createdAt,
      events: [],
    };
    base.events.push({
      id: newId("ev"),
      eventType: "created",
      actorRole: base.requesterRole,
      detail: { type: base.type },
      createdAt,
    });
    return base;
  };

  const seedRows: Dsar[] = [
    mk({ type: "access", status: "intake", createdAt: new Date(now - 1 * DAY_MS).toISOString() }),
    mk({
      type: "erasure",
      status: "assigned",
      identityVerified: true,
      assigneeId: "u_platform_1",
      createdAt: new Date(now - 10 * DAY_MS).toISOString(),
      subjectId: "lrn_demo_rio",
    }),
    // An overdue one to light up the banner/KPIs.
    mk({
      type: "portability",
      status: "approved",
      identityVerified: true,
      createdAt: new Date(now - 40 * DAY_MS).toISOString(),
      subjectId: "lrn_demo_ada",
      tenantId: "t_school_demo",
    }),
    mk({
      type: "access",
      status: "fulfilled",
      identityVerified: true,
      acknowledgedAt: new Date(now - 38 * DAY_MS).toISOString(),
      fulfilledAt: new Date(now - 30 * DAY_MS).toISOString(),
      createdAt: new Date(now - 39 * DAY_MS).toISOString(),
      subjectId: "lrn_demo_kai",
    }),
  ];
  for (const d of seedRows) dsars.set(d.id, d);

  for (const sub of ["lrn_demo_sky", "lrn_demo_rio"]) {
    for (const [type, granted] of [
      ["child_data_collection", true],
      ["ai_personalization", true],
      ["marketing_opt_in", false],
    ] as Array<[string, boolean]>) {
      consents.push({
        id: newId("consent"),
        tenantId: "t_district_demo",
        subjectId: sub,
        consentType: type,
        granted,
        actorRole: "parent",
        method: "parent_portal",
        createdAt: new Date(now - 20 * DAY_MS).toISOString(),
      });
    }
  }
}

// ── DSAR APIs ────────────────────────────────────────────────────────────────

export interface DsarScope {
  /** undefined = platform (all); array = restrict to these tenant ids. */
  tenantScope?: string[];
}

export function scopeForSession(role: string, tenantId: string): string[] | undefined {
  if (role === "platform_admin") return undefined;
  return scopeTenantsForSession(role as Role, tenantId).map((t) => t.id);
}

export function listDsars(filter: { status?: DsarStatus } & DsarScope = {}): Dsar[] {
  seed();
  return Array.from(dsars.values())
    .filter((d) => (filter.status ? d.status === filter.status : true))
    .filter((d) =>
      filter.tenantScope ? d.tenantId !== null && filter.tenantScope.includes(d.tenantId) : true,
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getDsar(id: string): Dsar | null {
  seed();
  return dsars.get(id) ?? null;
}

export interface DsarKpis {
  open: number;
  overdue: number;
  fulfilled: number;
  avgFulfillmentHours: number | null;
}

export function computeKpis(list: Dsar[], now: Date = new Date()): DsarKpis {
  const terminal = new Set<DsarStatus>(["fulfilled", "rejected"]);
  const open = list.filter((d) => !terminal.has(d.status)).length;
  const overdue = list.filter(
    (d) =>
      !terminal.has(d.status) &&
      evaluateSla({
        createdAt: d.createdAt,
        fulfillmentDays: d.fulfillmentDays,
        acknowledgedAt: d.acknowledgedAt,
        fulfilledAt: d.fulfilledAt,
        now,
      }).state === "overdue",
  ).length;
  const done = list.filter((d) => d.status === "fulfilled" && d.fulfilledAt);
  const fulfilled = done.length;
  const avgFulfillmentHours =
    fulfilled === 0
      ? null
      : Math.round(
          done.reduce(
            (s, d) =>
              s + (new Date(d.fulfilledAt!).getTime() - new Date(d.createdAt).getTime()) / HOUR_MS,
            0,
          ) / fulfilled,
        );
  return { open, overdue, fulfilled, avgFulfillmentHours };
}

export function slaFor(d: Dsar, now: Date = new Date()) {
  return evaluateSla({
    createdAt: d.createdAt,
    fulfillmentDays: d.fulfillmentDays,
    acknowledgedAt: d.acknowledgedAt,
    fulfilledAt: d.fulfilledAt,
    now,
  });
}

export function createDsar(input: {
  type: DsarType;
  subjectId: string;
  subjectType?: string;
  subjectEmail?: string | null;
  regulation?: Regulation;
  tenantId?: string | null;
  requesterId?: string | null;
  requesterRole?: string | null;
  onBehalfOfMinor?: boolean;
}): Dsar {
  seed();
  const regulation = input.regulation ?? "gdpr";
  const createdAt = new Date().toISOString();
  const d: Dsar = {
    id: newId("dsar"),
    tenantId: input.tenantId ?? null,
    type: input.type,
    regulation,
    subjectId: input.subjectId,
    subjectType: input.subjectType ?? "learner",
    subjectEmail: input.subjectEmail ?? null,
    requesterId: input.requesterId ?? null,
    requesterRole: input.requesterRole ?? null,
    onBehalfOfMinor: input.onBehalfOfMinor ?? false,
    status: "intake",
    identityVerified: false,
    assigneeId: null,
    evidence: [],
    fulfillmentDays: fulfillmentDaysFor(regulation),
    acknowledgedAt: null,
    fulfilledAt: null,
    createdAt,
    updatedAt: createdAt,
    events: [],
  };
  addEvent(d, "created", input.requesterRole ?? null, {
    type: input.type,
    onBehalfOfMinor: d.onBehalfOfMinor,
  });
  dsars.set(d.id, d);
  return d;
}

export type DsarAction = "verify-identity" | "assign" | "approve" | "reject" | "fulfill";

export function transitionDsar(
  id: string,
  action: DsarAction,
  actor: { actorId?: string | null; actorRole?: string | null },
  payload: { method?: string; assigneeId?: string; reason?: string } = {},
): { ok: true; dsar: Dsar } | { ok: false; reason: string } {
  const d = getDsar(id);
  if (!d) return { ok: false, reason: "not_found" };
  const role = actor.actorRole ?? null;
  switch (action) {
    case "verify-identity":
      d.identityVerified = true;
      d.acknowledgedAt = d.acknowledgedAt ?? new Date().toISOString();
      d.status = "identity_verification";
      addEvent(d, "identity_verified", role, { method: payload.method ?? "manual" });
      break;
    case "assign":
      d.assigneeId = payload.assigneeId ?? actor.actorId ?? "unassigned";
      d.status = "assigned";
      addEvent(d, "assigned", role, { assigneeId: d.assigneeId });
      break;
    case "approve":
      if (!d.identityVerified) return { ok: false, reason: "identity_unverified" };
      d.status = "approved";
      addEvent(d, "approved", role);
      break;
    case "reject":
      d.status = "rejected";
      addEvent(d, "rejected", role, { reason: payload.reason ?? "not specified" });
      break;
    case "fulfill": {
      if (d.status !== "approved" && d.status !== "fulfilling") {
        return { ok: false, reason: "not_approved" };
      }
      d.status = "fulfilling";
      addEvent(d, "fulfillment_started", role);
      const bundle = buildExportBundle(d);
      const checksum = `sha256:${Math.abs(hash(JSON.stringify(bundle))).toString(16)}`;
      d.evidence.push(
        d.type === "erasure"
          ? {
              kind: "erasure_receipt",
              checksum,
              services: bundle.manifest.services,
              totalErased: 17,
            }
          : { kind: "export_bundle", manifest: bundle.manifest, art20Valid: true },
      );
      d.status = "fulfilled";
      d.fulfilledAt = new Date().toISOString();
      addEvent(d, "fulfilled", role, { type: d.type, checksum });
      break;
    }
  }
  dsars.set(d.id, d);
  return { ok: true, dsar: d };
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h;
}

export interface ExportBundle {
  manifest: {
    format: "json";
    schemaVersion: string;
    generatedAt: string;
    subjectId: string;
    subjectType: string;
    regulation: "GDPR Art. 20";
    services: string[];
    recordCounts: Record<string, number>;
  };
  data: Record<string, unknown>;
}

/** Assemble a GDPR Art. 20 bundle for a subject from the seeded services. */
export function buildExportBundle(d: Dsar): ExportBundle {
  const services = Array.from(new Set(DATA_CATALOG.map((c) => c.owningService))).sort();
  const recordCounts: Record<string, number> = {};
  const data: Record<string, unknown> = {};
  for (const svc of services) {
    recordCounts[svc] = DATA_CATALOG.filter((c) => c.owningService === svc).length;
    data[svc] = {
      dataClasses: DATA_CATALOG.filter((c) => c.owningService === svc).map((c) => c.dataClass),
    };
  }
  return {
    manifest: {
      format: "json",
      schemaVersion: "1.0",
      generatedAt: new Date().toISOString(),
      subjectId: d.subjectId,
      subjectType: d.subjectType,
      regulation: "GDPR Art. 20",
      services,
      recordCounts,
    },
    data,
  };
}

// ── Consent APIs ─────────────────────────────────────────────────────────────

export function searchConsents(
  search: { subjectId?: string; consentType?: string } & DsarScope = {},
): ConsentRecord[] {
  seed();
  return consents
    .filter((c) => (search.subjectId ? c.subjectId === search.subjectId : true))
    .filter((c) => (search.consentType ? c.consentType === search.consentType : true))
    .filter((c) =>
      search.tenantScope ? c.tenantId !== null && search.tenantScope.includes(c.tenantId) : true,
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function recordConsent(input: {
  subjectId: string;
  consentType: string;
  granted: boolean;
  tenantId?: string | null;
  actorRole?: string | null;
  method?: string | null;
}): ConsentRecord {
  seed();
  const rec: ConsentRecord = {
    id: newId("consent"),
    tenantId: input.tenantId ?? null,
    subjectId: input.subjectId,
    consentType: input.consentType,
    granted: input.granted,
    actorRole: input.actorRole ?? null,
    method: input.method ?? null,
    createdAt: new Date().toISOString(),
  };
  consents.push(rec);
  return rec;
}

// ── Retention APIs ───────────────────────────────────────────────────────────

export function getRetentionPolicy(dataClass: string): RetentionPolicy {
  seed();
  const existing = policies.get(dataClass);
  if (existing) return existing;
  const cat = DATA_CATALOG.find((c) => c.dataClass === dataClass);
  return {
    dataClass,
    retentionDays: cat?.defaultRetentionDays ?? null,
    disposition: dataClass === "audit_events" ? "anonymize" : "purge",
    legalHold: false,
    updatedAt: new Date(0).toISOString(),
  };
}

export function listRetentionPolicies(): Array<DataClass & { retention: RetentionPolicy }> {
  seed();
  return DATA_CATALOG.map((c) => ({ ...c, retention: getRetentionPolicy(c.dataClass) }));
}

export function setRetentionPolicy(input: {
  dataClass: string;
  retentionDays: number | null;
  disposition: Disposition;
  legalHold?: boolean;
}): RetentionPolicy {
  seed();
  const rec: RetentionPolicy = {
    dataClass: input.dataClass,
    retentionDays: input.retentionDays,
    disposition: input.disposition,
    legalHold: input.legalHold ?? false,
    updatedAt: new Date().toISOString(),
  };
  policies.set(input.dataClass, rec);
  return rec;
}

/**
 * "What would be deleted" preview: synthesize a representative record
 * population per class and count how many fall outside the window. Pure +
 * deterministic so the UI preview is stable.
 */
export function previewRetention(dataClass: string): {
  dataClass: string;
  disposition: Disposition;
  retentionDays: number | null;
  legalHold: boolean;
  totalCount: number;
  eligibleCount: number;
} {
  const policy = getRetentionPolicy(dataClass);
  // Synthetic population spread across the last ~7 years.
  const now = Date.now();
  const sample = Array.from({ length: 120 }, (_, i) => now - i * 21 * DAY_MS);
  const cutoff =
    policy.legalHold || policy.retentionDays === null ? null : now - policy.retentionDays * DAY_MS;
  const eligibleCount = cutoff === null ? 0 : sample.filter((t) => t <= cutoff).length;
  return {
    dataClass,
    disposition: policy.disposition,
    retentionDays: policy.retentionDays,
    legalHold: policy.legalHold,
    totalCount: sample.length,
    eligibleCount,
  };
}

export function listCatalog(): DataClass[] {
  return [...DATA_CATALOG].sort((a, b) => a.dataClass.localeCompare(b.dataClass));
}

/** Resolve a display name for a tenant id (for queue/scope columns). */
export function tenantName(tenantId: string | null): string {
  if (!tenantId) return "—";
  return getTenantById(tenantId)?.name ?? tenantId;
}
