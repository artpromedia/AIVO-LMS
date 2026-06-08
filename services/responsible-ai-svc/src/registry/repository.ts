/**
 * Registry repository — persistence abstraction for the Responsible AI
 * Console.
 *
 * responsible-ai-svc historically served registry data from a process-local
 * in-memory store (see store.ts). This module introduces a DB-or-fallback
 * boundary modelled on data-governance-svc's dpa-store:
 *
 *   - InMemoryRegistryRepository  — wraps the existing seeded Maps. Used by
 *     unit tests and local dev (no DATABASE_URL). Preserves the deterministic
 *     seed fixtures so evals / policy resolution / the admin console remain
 *     demoable and testable without a database.
 *   - PostgresRegistryRepository  — drizzle against the rai_* tables declared
 *     in @aivo/db. Records survive restart and remain queryable for audits.
 *   - selectRegistryRepository(db) — picks Postgres when a drizzle client is
 *     supplied, THROWS in production when none is, else falls back to
 *     in-memory (dev / tests only).
 *
 * Every method is async so the two implementations are interchangeable; the
 * route handlers (already async) simply `await` them. The HTTP route paths
 * and JSON response shapes are unchanged — only persistence is swapped.
 */
import {
  raiEvalRuns,
  raiIncidents,
  raiModelCards,
  raiModelVersions,
  raiModels,
  raiOptouts,
  raiPolicies,
  raiUsageAggregates,
} from "@aivo/db";
import { and, eq } from "drizzle-orm";
import type {
  EvalRun,
  ModelCard,
  ModelRecord,
  ModelVersion,
  OptOut,
  PolicyRecord,
  RaiIncident,
  UsageAggregate,
} from "./types.js";
import { createSeededStore, SEED_TENANT_DISTRICT, type RegistryStore } from "./store.js";

const SEED_TENANT_DISTRICT_MAP = new Map<string, string>(
  SEED_TENANT_DISTRICT.map(([t, d]) => [t, d]),
);

/**
 * Snapshot of the records policy resolution needs. Shaped like the relevant
 * slice of {@link RegistryStore} so the pure, synchronous
 * `resolveEffectivePolicy` (which carries a <5ms p95 DoD budget) can keep
 * operating over plain Maps regardless of the backing store.
 */
export interface PolicyResolutionSnapshot {
  policies: Map<string, PolicyRecord>;
  models: Map<string, ModelRecord>;
  optOuts: Map<string, OptOut>;
  tenantDistrict: Map<string, string>;
}

export interface RegistryRepository {
  // ── Models ──────────────────────────────────────────────────────────
  listModels(): Promise<ModelRecord[]>;
  getModel(id: string): Promise<ModelRecord | undefined>;
  upsertModel(model: ModelRecord): Promise<ModelRecord>;

  // ── Versions ────────────────────────────────────────────────────────
  listVersions(modelId?: string): Promise<ModelVersion[]>;

  // ── Cards ───────────────────────────────────────────────────────────
  getCard(modelId: string): Promise<ModelCard | undefined>;

  // ── Policies ────────────────────────────────────────────────────────
  listPolicies(): Promise<PolicyRecord[]>;
  getPolicy(id: string): Promise<PolicyRecord | undefined>;
  upsertPolicy(policy: PolicyRecord): Promise<PolicyRecord>;

  // ── Eval runs ───────────────────────────────────────────────────────
  listEvalRuns(modelId?: string): Promise<EvalRun[]>;
  getEvalRun(id: string): Promise<EvalRun | undefined>;
  upsertEvalRun(run: EvalRun): Promise<EvalRun>;

  // ── Incidents ───────────────────────────────────────────────────────
  listIncidents(): Promise<RaiIncident[]>;
  getIncident(id: string): Promise<RaiIncident | undefined>;
  upsertIncident(incident: RaiIncident): Promise<RaiIncident>;

  // ── Opt-outs ────────────────────────────────────────────────────────
  listOptOuts(): Promise<OptOut[]>;
  getOptOut(id: string): Promise<OptOut | undefined>;
  upsertOptOut(optOut: OptOut): Promise<OptOut>;
  deleteOptOut(id: string): Promise<void>;

  // ── Usage ───────────────────────────────────────────────────────────
  listUsage(): Promise<UsageAggregate[]>;

  // ── Tenant → district mapping (policy resolution / opt-out cascade) ──
  getDistrictForTenant(tenantId: string): Promise<string | undefined>;

  // ── Snapshot for the pure policy-resolution function ────────────────
  policyResolutionSnapshot(): Promise<PolicyResolutionSnapshot>;
}

// ─────────────────────────────────────────────────────────────────────────
// In-memory implementation (seeded fixtures; tests / dev).
// ─────────────────────────────────────────────────────────────────────────

export class InMemoryRegistryRepository implements RegistryRepository {
  private readonly store: RegistryStore;

  constructor(store: RegistryStore = createSeededStore()) {
    this.store = store;
  }

  async listModels(): Promise<ModelRecord[]> {
    return [...this.store.models.values()];
  }
  async getModel(id: string): Promise<ModelRecord | undefined> {
    return this.store.models.get(id);
  }
  async upsertModel(model: ModelRecord): Promise<ModelRecord> {
    this.store.models.set(model.id, model);
    return model;
  }

  async listVersions(modelId?: string): Promise<ModelVersion[]> {
    const all = [...this.store.versions.values()];
    return modelId ? all.filter((v) => v.modelId === modelId) : all;
  }

  async getCard(modelId: string): Promise<ModelCard | undefined> {
    return this.store.cards.get(modelId);
  }

  async listPolicies(): Promise<PolicyRecord[]> {
    return [...this.store.policies.values()];
  }
  async getPolicy(id: string): Promise<PolicyRecord | undefined> {
    return this.store.policies.get(id);
  }
  async upsertPolicy(policy: PolicyRecord): Promise<PolicyRecord> {
    this.store.policies.set(policy.id, policy);
    return policy;
  }

  async listEvalRuns(modelId?: string): Promise<EvalRun[]> {
    const all = [...this.store.evalRuns.values()];
    return modelId ? all.filter((r) => r.modelId === modelId) : all;
  }
  async getEvalRun(id: string): Promise<EvalRun | undefined> {
    return this.store.evalRuns.get(id);
  }
  async upsertEvalRun(run: EvalRun): Promise<EvalRun> {
    this.store.evalRuns.set(run.id, run);
    return run;
  }

  async listIncidents(): Promise<RaiIncident[]> {
    return [...this.store.incidents.values()];
  }
  async getIncident(id: string): Promise<RaiIncident | undefined> {
    return this.store.incidents.get(id);
  }
  async upsertIncident(incident: RaiIncident): Promise<RaiIncident> {
    this.store.incidents.set(incident.id, incident);
    return incident;
  }

  async listOptOuts(): Promise<OptOut[]> {
    return [...this.store.optOuts.values()];
  }
  async getOptOut(id: string): Promise<OptOut | undefined> {
    return this.store.optOuts.get(id);
  }
  async upsertOptOut(optOut: OptOut): Promise<OptOut> {
    this.store.optOuts.set(optOut.id, optOut);
    return optOut;
  }
  async deleteOptOut(id: string): Promise<void> {
    this.store.optOuts.delete(id);
  }

  async listUsage(): Promise<UsageAggregate[]> {
    return [...this.store.usage];
  }

  async getDistrictForTenant(tenantId: string): Promise<string | undefined> {
    return this.store.tenantDistrict.get(tenantId);
  }

  async policyResolutionSnapshot(): Promise<PolicyResolutionSnapshot> {
    return {
      policies: this.store.policies,
      models: this.store.models,
      optOuts: this.store.optOuts,
      tenantDistrict: this.store.tenantDistrict,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Postgres implementation (drizzle against rai_* tables).
// ─────────────────────────────────────────────────────────────────────────

function toIso(v: Date | string | null | undefined): string {
  if (v == null) return "";
  return v instanceof Date ? v.toISOString() : v;
}
function toIsoOrNull(v: Date | string | null | undefined): string | null {
  if (v == null) return null;
  return v instanceof Date ? v.toISOString() : v;
}

function modelRowToRecord(row: typeof raiModels.$inferSelect): ModelRecord {
  return {
    id: row.id,
    name: row.name,
    provider: row.provider,
    modality: row.modality as ModelRecord["modality"],
    status: row.status as ModelRecord["status"],
    owner: { team: row.ownerTeam, contact: row.ownerContact },
    intendedUse: row.intendedUse,
    outOfScopeUse: row.outOfScopeUse,
    currentVersionId: row.currentVersionId,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

function versionRowToRecord(row: typeof raiModelVersions.$inferSelect): ModelVersion {
  return {
    id: row.id,
    modelId: row.modelId,
    version: row.version,
    releasedAt: toIso(row.releasedAt),
    changelog: row.changelog,
    provenanceHash: row.provenanceHash,
  };
}

function policyRowToRecord(row: typeof raiPolicies.$inferSelect): PolicyRecord {
  return {
    id: row.id,
    name: row.name,
    scopeLevel: row.scopeLevel as PolicyRecord["scopeLevel"],
    scopeId: row.scopeId,
    contentSafety: row.contentSafety as PolicyRecord["contentSafety"],
    ageGating: row.ageGating as PolicyRecord["ageGating"],
    regionRestrictions: row.regionRestrictions as PolicyRecord["regionRestrictions"],
    enabled: row.enabled,
    updatedAt: toIso(row.updatedAt),
    updatedBy: row.updatedBy,
  };
}

function evalRunRowToRecord(row: typeof raiEvalRuns.$inferSelect): EvalRun {
  return {
    id: row.id,
    modelId: row.modelId,
    harness: row.harness as EvalRun["harness"],
    status: row.status as EvalRun["status"],
    metrics: (row.metrics as EvalRun["metrics"]) ?? null,
    cases: (row.cases as EvalRun["cases"]) ?? [],
    startedAt: toIso(row.startedAt),
    completedAt: toIsoOrNull(row.completedAt),
    triggeredBy: row.triggeredBy,
  };
}

function incidentRowToRecord(row: typeof raiIncidents.$inferSelect): RaiIncident {
  return {
    id: row.id,
    modelId: row.modelId,
    tenantId: row.tenantId,
    title: row.title,
    description: row.description,
    severity: row.severity as RaiIncident["severity"],
    state: row.state as RaiIncident["state"],
    reportedBy: row.reportedBy,
    reportedByRole: row.reportedByRole,
    timeline: (row.timeline as RaiIncident["timeline"]) ?? [],
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

function optOutRowToRecord(row: typeof raiOptouts.$inferSelect): OptOut {
  return {
    id: row.id,
    tenantId: row.tenantId,
    modelId: row.modelId,
    feature: row.feature,
    reason: row.reason,
    createdBy: row.createdBy,
    createdByRole: row.createdByRole,
    createdAt: toIso(row.createdAt),
  };
}

function usageRowToRecord(row: typeof raiUsageAggregates.$inferSelect): UsageAggregate {
  return {
    modelId: row.modelId,
    tenantId: row.tenantId,
    date: typeof row.date === "string" ? row.date : toIso(row.date as unknown as Date).slice(0, 10),
    calls: Number(row.calls),
    tokens: Number(row.tokens),
    costUsd: Number(row.costUsd),
  };
}

export class PostgresRegistryRepository implements RegistryRepository {
  // `db` is a drizzle client (`createDb(DATABASE_URL)` from @aivo/db).
  // Typed as `any` to keep this file dependency-light; the real type is
  // exercised in integration tests.
  constructor(private readonly db: any) {}

  async listModels(): Promise<ModelRecord[]> {
    const rows = await this.db.select().from(raiModels);
    return rows.map(modelRowToRecord);
  }
  async getModel(id: string): Promise<ModelRecord | undefined> {
    const rows = await this.db.select().from(raiModels).where(eq(raiModels.id, id)).limit(1);
    return rows[0] ? modelRowToRecord(rows[0]) : undefined;
  }
  async upsertModel(model: ModelRecord): Promise<ModelRecord> {
    const values = {
      id: model.id,
      name: model.name,
      provider: model.provider,
      modality: model.modality,
      status: model.status,
      ownerTeam: model.owner.team,
      ownerContact: model.owner.contact,
      intendedUse: model.intendedUse,
      outOfScopeUse: model.outOfScopeUse,
      currentVersionId: model.currentVersionId,
      createdAt: new Date(model.createdAt),
      updatedAt: new Date(model.updatedAt),
    };
    await this.db
      .insert(raiModels)
      .values(values)
      .onConflictDoUpdate({
        target: raiModels.id,
        set: {
          name: values.name,
          provider: values.provider,
          modality: values.modality,
          status: values.status,
          ownerTeam: values.ownerTeam,
          ownerContact: values.ownerContact,
          intendedUse: values.intendedUse,
          outOfScopeUse: values.outOfScopeUse,
          currentVersionId: values.currentVersionId,
          updatedAt: values.updatedAt,
        },
      });
    return model;
  }

  async listVersions(modelId?: string): Promise<ModelVersion[]> {
    const rows = modelId
      ? await this.db
          .select()
          .from(raiModelVersions)
          .where(eq(raiModelVersions.modelId, modelId))
      : await this.db.select().from(raiModelVersions);
    return rows.map(versionRowToRecord);
  }

  async getCard(modelId: string): Promise<ModelCard | undefined> {
    const rows = await this.db
      .select()
      .from(raiModelCards)
      .where(eq(raiModelCards.modelId, modelId))
      .limit(1);
    if (!rows[0]) return undefined;
    return {
      modelId: rows[0].modelId,
      markdown: rows[0].markdown,
      metadata: rows[0].metadata as ModelCard["metadata"],
    };
  }

  async listPolicies(): Promise<PolicyRecord[]> {
    const rows = await this.db.select().from(raiPolicies);
    return rows.map(policyRowToRecord);
  }
  async getPolicy(id: string): Promise<PolicyRecord | undefined> {
    const rows = await this.db.select().from(raiPolicies).where(eq(raiPolicies.id, id)).limit(1);
    return rows[0] ? policyRowToRecord(rows[0]) : undefined;
  }
  async upsertPolicy(policy: PolicyRecord): Promise<PolicyRecord> {
    const values = {
      id: policy.id,
      name: policy.name,
      scopeLevel: policy.scopeLevel,
      scopeId: policy.scopeId,
      contentSafety: policy.contentSafety,
      ageGating: policy.ageGating,
      regionRestrictions: policy.regionRestrictions,
      enabled: policy.enabled,
      updatedAt: new Date(policy.updatedAt),
      updatedBy: policy.updatedBy,
    };
    await this.db
      .insert(raiPolicies)
      .values(values)
      .onConflictDoUpdate({
        target: raiPolicies.id,
        set: {
          name: values.name,
          scopeLevel: values.scopeLevel,
          scopeId: values.scopeId,
          contentSafety: values.contentSafety,
          ageGating: values.ageGating,
          regionRestrictions: values.regionRestrictions,
          enabled: values.enabled,
          updatedAt: values.updatedAt,
          updatedBy: values.updatedBy,
        },
      });
    return policy;
  }

  async listEvalRuns(modelId?: string): Promise<EvalRun[]> {
    const rows = modelId
      ? await this.db.select().from(raiEvalRuns).where(eq(raiEvalRuns.modelId, modelId))
      : await this.db.select().from(raiEvalRuns);
    return rows.map(evalRunRowToRecord);
  }
  async getEvalRun(id: string): Promise<EvalRun | undefined> {
    const rows = await this.db.select().from(raiEvalRuns).where(eq(raiEvalRuns.id, id)).limit(1);
    return rows[0] ? evalRunRowToRecord(rows[0]) : undefined;
  }
  async upsertEvalRun(run: EvalRun): Promise<EvalRun> {
    const values = {
      id: run.id,
      modelId: run.modelId,
      harness: run.harness,
      status: run.status,
      metrics: run.metrics,
      cases: run.cases,
      startedAt: new Date(run.startedAt),
      completedAt: run.completedAt ? new Date(run.completedAt) : null,
      triggeredBy: run.triggeredBy,
    };
    await this.db
      .insert(raiEvalRuns)
      .values(values)
      .onConflictDoUpdate({
        target: raiEvalRuns.id,
        set: {
          modelId: values.modelId,
          harness: values.harness,
          status: values.status,
          metrics: values.metrics,
          cases: values.cases,
          startedAt: values.startedAt,
          completedAt: values.completedAt,
          triggeredBy: values.triggeredBy,
        },
      });
    return run;
  }

  async listIncidents(): Promise<RaiIncident[]> {
    const rows = await this.db.select().from(raiIncidents);
    return rows.map(incidentRowToRecord);
  }
  async getIncident(id: string): Promise<RaiIncident | undefined> {
    const rows = await this.db.select().from(raiIncidents).where(eq(raiIncidents.id, id)).limit(1);
    return rows[0] ? incidentRowToRecord(rows[0]) : undefined;
  }
  async upsertIncident(incident: RaiIncident): Promise<RaiIncident> {
    const values = {
      id: incident.id,
      modelId: incident.modelId,
      tenantId: incident.tenantId,
      title: incident.title,
      description: incident.description,
      severity: incident.severity,
      state: incident.state,
      reportedBy: incident.reportedBy,
      reportedByRole: incident.reportedByRole,
      timeline: incident.timeline,
      createdAt: new Date(incident.createdAt),
      updatedAt: new Date(incident.updatedAt),
    };
    await this.db
      .insert(raiIncidents)
      .values(values)
      .onConflictDoUpdate({
        target: raiIncidents.id,
        set: {
          modelId: values.modelId,
          tenantId: values.tenantId,
          title: values.title,
          description: values.description,
          severity: values.severity,
          state: values.state,
          reportedBy: values.reportedBy,
          reportedByRole: values.reportedByRole,
          timeline: values.timeline,
          updatedAt: values.updatedAt,
        },
      });
    return incident;
  }

  async listOptOuts(): Promise<OptOut[]> {
    const rows = await this.db.select().from(raiOptouts);
    return rows.map(optOutRowToRecord);
  }
  async getOptOut(id: string): Promise<OptOut | undefined> {
    const rows = await this.db.select().from(raiOptouts).where(eq(raiOptouts.id, id)).limit(1);
    return rows[0] ? optOutRowToRecord(rows[0]) : undefined;
  }
  async upsertOptOut(optOut: OptOut): Promise<OptOut> {
    const values = {
      id: optOut.id,
      tenantId: optOut.tenantId,
      modelId: optOut.modelId,
      feature: optOut.feature,
      reason: optOut.reason,
      createdBy: optOut.createdBy,
      createdByRole: optOut.createdByRole,
      createdAt: new Date(optOut.createdAt),
    };
    await this.db
      .insert(raiOptouts)
      .values(values)
      .onConflictDoUpdate({
        target: raiOptouts.id,
        set: {
          tenantId: values.tenantId,
          modelId: values.modelId,
          feature: values.feature,
          reason: values.reason,
          createdBy: values.createdBy,
          createdByRole: values.createdByRole,
        },
      });
    return optOut;
  }
  async deleteOptOut(id: string): Promise<void> {
    await this.db.delete(raiOptouts).where(eq(raiOptouts.id, id));
  }

  async listUsage(): Promise<UsageAggregate[]> {
    const rows = await this.db.select().from(raiUsageAggregates);
    return rows.map(usageRowToRecord);
  }

  async getDistrictForTenant(tenantId: string): Promise<string | undefined> {
    // Tenant → district mapping is not modelled by the registry tables; it is
    // a shared seed constant (see SEED_TENANT_DISTRICT in store.ts) consulted
    // by both repositories so district policy resolution and the district
    // opt-out cascade behave identically regardless of backing store.
    return SEED_TENANT_DISTRICT_MAP.get(tenantId);
  }

  async policyResolutionSnapshot(): Promise<PolicyResolutionSnapshot> {
    const [policies, models, optOuts] = await Promise.all([
      this.listPolicies(),
      this.listModels(),
      this.listOptOuts(),
    ]);
    return {
      policies: new Map(policies.map((p) => [p.id, p])),
      models: new Map(models.map((m) => [m.id, m])),
      optOuts: new Map(optOuts.map((o) => [o.id, o])),
      tenantDistrict: new Map(SEED_TENANT_DISTRICT_MAP),
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Selection + singleton wiring (mirrors getStore() ergonomics, async).
// ─────────────────────────────────────────────────────────────────────────

/**
 * Pick the repository implementation at boot. Production requires a drizzle
 * client (registry records must survive restart and remain queryable for
 * audits); non-production tolerates the seeded in-memory repository.
 *
 * Pass a drizzle client to use Postgres; pass `null` to force in-memory
 * (allowed only outside production — throws otherwise).
 */
export function selectRegistryRepository(db: any | null | undefined): RegistryRepository {
  if (db) return new PostgresRegistryRepository(db);
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "responsible-ai-svc: DATABASE_URL / drizzle client required in production. " +
        "InMemoryRegistryRepository must NOT be used in production — registry " +
        "records (models, policies, incidents, evals, opt-outs) would be lost on " +
        "restart, breaking safety auditability.",
    );
  }
  return new InMemoryRegistryRepository();
}

let repository: RegistryRepository | null = null;

/** Initialize the singleton from a (possibly absent) drizzle client. */
export function initRegistryRepository(db: any | null | undefined): RegistryRepository {
  repository = selectRegistryRepository(db);
  return repository;
}

/** Override the singleton directly (used by tests to inject a seeded repo). */
export function setRegistryRepository(repo: RegistryRepository): void {
  repository = repo;
}

/**
 * Accessor mirroring getStore()'s singleton ergonomics. Falls back to a
 * seeded in-memory repository on first use when nothing was initialized
 * (dev / tests) — production wires Postgres explicitly at boot.
 */
export function getRegistryRepository(): RegistryRepository {
  if (!repository) repository = new InMemoryRegistryRepository();
  return repository;
}

/** Test helper: reset the singleton to a fresh seeded in-memory repository. */
export function resetRegistryRepository(): RegistryRepository {
  repository = new InMemoryRegistryRepository();
  return repository;
}
