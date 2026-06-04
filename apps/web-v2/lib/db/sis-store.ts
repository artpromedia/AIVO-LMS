/**
 * SIS roster-sync connector registry (Sprint 2).
 *
 * In-memory singleton standing in for integration-svc's `sis_configs`,
 * `sync_runs`, `sync_rows`, and `sync_errors` tables — same pattern as the
 * other web-v2 datasets. Shapes mirror the service so the swap to a live
 * BFF proxy is mechanical. SIS credentials are NEVER stored here in
 * plaintext; the store keeps only a non-secret summary (provider + a masked
 * client id), matching the "encrypted at rest / redacted in logs" rule.
 */
import type { ID, ISODate } from "@/lib/db/types";

export type SisProvider = "oneroster_rest" | "oneroster_csv" | "clever" | "classlink";
export type SyncType = "full" | "delta";
export type RunStatus = "running" | "success" | "failed" | "paused";

export type FieldMapping = {
  emailDomain: string;
  studentRole: string;
  teacherRole: string;
  /** Map SIS grade strings to AIVO grade bands. */
  gradeMap: Record<string, string>;
};

export type SisConnector = {
  id: ID;
  tenantId: ID;
  provider: SisProvider;
  displayName: string;
  enabled: boolean;
  /** Masked credential summary (never the secret). */
  credentialHint: string | null;
  fullScheduleCron: string;
  deltaScheduleCron: string;
  /** Max fraction of population a run may mutate before pausing. */
  maxMutationRatio: number;
  mapping: FieldMapping;
  createdAt: ISODate;
  updatedAt: ISODate;
};

export type SyncRunCounts = { added: number; updated: number; removed: number };

export type SyncRun = {
  id: ID;
  connectorId: ID;
  type: SyncType;
  dryRun: boolean;
  status: RunStatus;
  startedAt: ISODate;
  finishedAt: ISODate | null;
  counts: SyncRunCounts;
  population: number;
  mutationRatio: number;
  pauseReason: string | null;
  errorCount: number;
};

export type SyncError = {
  id: ID;
  runId: ID;
  connectorId: ID;
  entity: string;
  sourcedId: string;
  message: string;
  retryable: boolean;
  resolvedAt: ISODate | null;
};

type Tables = {
  connectors: SisConnector[];
  runs: SyncRun[];
  errors: SyncError[];
};

declare global {
  var __aivoSisStore: Tables | undefined;
}

function tables(): Tables {
  if (!globalThis.__aivoSisStore) {
    globalThis.__aivoSisStore = { connectors: [], runs: [], errors: [] };
    seed(globalThis.__aivoSisStore);
  }
  return globalThis.__aivoSisStore;
}

function nowIso(): ISODate {
  return new Date().toISOString();
}
function newId(p: string): ID {
  return `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function defaultMapping(): FieldMapping {
  return { emailDomain: "", studentRole: "learner", teacherRole: "teacher", gradeMap: {} };
}

export function listConnectors(tenantId?: ID): SisConnector[] {
  const all = tables().connectors;
  return (tenantId ? all.filter((c) => c.tenantId === tenantId) : all)
    .slice()
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export function getConnector(id: ID): SisConnector | null {
  return tables().connectors.find((c) => c.id === id) ?? null;
}

export type CreateConnectorInput = {
  tenantId: ID;
  provider: SisProvider;
  displayName: string;
  credentialHint?: string | null;
  mapping?: Partial<FieldMapping>;
  maxMutationRatio?: number;
};

export function createConnector(input: CreateConnectorInput): SisConnector {
  const rec: SisConnector = {
    id: newId("sis"),
    tenantId: input.tenantId,
    provider: input.provider,
    displayName: input.displayName,
    enabled: true,
    credentialHint: input.credentialHint ?? null,
    fullScheduleCron: "0 2 * * *",
    deltaScheduleCron: "0 */4 * * *",
    maxMutationRatio: input.maxMutationRatio ?? 0.1,
    mapping: { ...defaultMapping(), ...(input.mapping ?? {}) },
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  tables().connectors.push(rec);
  return rec;
}

export function updateConnector(
  id: ID,
  patch: Partial<Omit<SisConnector, "id" | "tenantId" | "createdAt" | "mapping">> & {
    mapping?: Partial<FieldMapping>;
  },
): SisConnector | null {
  const c = getConnector(id);
  if (!c) return null;
  Object.assign(c, patch, {
    mapping: { ...c.mapping, ...(patch.mapping ?? {}) },
    updatedAt: nowIso(),
  });
  return c;
}

export function deleteConnector(id: ID): boolean {
  const t = tables();
  const idx = t.connectors.findIndex((c) => c.id === id);
  if (idx === -1) return false;
  t.connectors.splice(idx, 1);
  t.runs = t.runs.filter((r) => r.connectorId !== id);
  t.errors = t.errors.filter((e) => e.connectorId !== id);
  return true;
}

export function listRuns(connectorId: ID, limit = 10): SyncRun[] {
  return tables()
    .runs.filter((r) => r.connectorId === connectorId)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, limit);
}

export function latestRun(connectorId: ID): SyncRun | null {
  return listRuns(connectorId, 1)[0] ?? null;
}

/**
 * Simulate a sync run. Produces realistic counts; honors dry-run (no
 * "writes") and the mutation cap (pauses when the simulated mutation set
 * would exceed the connector's ratio).
 */
export function triggerRun(connectorId: ID, type: SyncType, dryRun: boolean): SyncRun | null {
  const c = getConnector(connectorId);
  if (!c) return null;
  const population = 1200;
  // Delta runs touch fewer rows than full runs.
  const added = type === "full" ? 8 : 2;
  const updated = type === "full" ? 40 : 6;
  const removed = type === "full" ? 3 : 1;
  const mutations = added + updated + removed;
  const mutationRatio = mutations / population;
  const exceeds = mutationRatio > c.maxMutationRatio;

  const run: SyncRun = {
    id: newId("run"),
    connectorId,
    type,
    dryRun,
    status: exceeds ? "paused" : "success",
    startedAt: nowIso(),
    finishedAt: exceeds ? null : nowIso(),
    counts: { added, updated, removed },
    population,
    mutationRatio,
    pauseReason: exceeds
      ? `Run would mutate ${mutations} rows (${(mutationRatio * 100).toFixed(1)}%), exceeding the ${(c.maxMutationRatio * 100).toFixed(0)}% cap.`
      : null,
    errorCount: 0,
  };
  tables().runs.push(run);
  return run;
}

export function listErrors(
  connectorId: ID,
  cursor?: string,
  pageSize = 20,
): { errors: SyncError[]; nextCursor: string | null } {
  const all = tables()
    .errors.filter((e) => e.connectorId === connectorId && !e.resolvedAt)
    .sort((a, b) => a.id.localeCompare(b.id));
  const start = cursor ? all.findIndex((e) => e.id === cursor) + 1 : 0;
  const page = all.slice(start, start + pageSize);
  const nextCursor = start + pageSize < all.length ? (page[page.length - 1]?.id ?? null) : null;
  return { errors: page, nextCursor };
}

/** Inject a malformed-row error (used by the e2e error-drilldown path). */
export function injectError(connectorId: ID, partial?: Partial<SyncError>): SyncError | null {
  const c = getConnector(connectorId);
  if (!c) return null;
  const run = latestRun(connectorId);
  const err: SyncError = {
    id: newId("err"),
    runId: run?.id ?? "run_none",
    connectorId,
    entity: partial?.entity ?? "users",
    sourcedId: partial?.sourcedId ?? "usr-bad-1",
    message: partial?.message ?? "Missing required field: email",
    retryable: partial?.retryable ?? true,
    resolvedAt: null,
  };
  tables().errors.push(err);
  if (run) run.errorCount += 1;
  return err;
}

export function retryError(connectorId: ID, errorId: ID): boolean {
  const err = tables().errors.find((e) => e.id === errorId && e.connectorId === connectorId);
  if (!err || err.resolvedAt) return false;
  err.resolvedAt = nowIso();
  return true;
}

export function retryAll(connectorId: ID): number {
  let n = 0;
  for (const e of tables().errors) {
    if (e.connectorId === connectorId && !e.resolvedAt) {
      e.resolvedAt = nowIso();
      n++;
    }
  }
  return n;
}

function seed(t: Tables): void {
  // A demo OneRoster connector for the seed district so the UI has content.
  // Matches the mock district_admin session tenant (lib/auth/mock-session.ts).
  const tenantId = "t_district_demo";
  const c: SisConnector = {
    id: "sis_demo_oneroster",
    tenantId,
    provider: "oneroster_rest",
    displayName: "PowerSchool (OneRoster)",
    enabled: true,
    credentialHint: "client_id ····a1b2",
    fullScheduleCron: "0 2 * * *",
    deltaScheduleCron: "0 */4 * * *",
    maxMutationRatio: 0.1,
    mapping: {
      emailDomain: "springfield.k12",
      studentRole: "learner",
      teacherRole: "teacher",
      gradeMap: {},
    },
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  t.connectors.push(c);
  t.runs.push({
    id: "run_demo_1",
    connectorId: c.id,
    type: "full",
    dryRun: false,
    status: "success",
    startedAt: new Date(Date.now() - 3600_000).toISOString(),
    finishedAt: new Date(Date.now() - 3590_000).toISOString(),
    counts: { added: 12, updated: 34, removed: 2 },
    population: 1200,
    mutationRatio: 48 / 1200,
    pauseReason: null,
    errorCount: 1,
  });
  // One malformed-row error so the error drill-down + retry path has content.
  t.errors.push({
    id: "err_demo_1",
    runId: "run_demo_1",
    connectorId: c.id,
    entity: "users",
    sourcedId: "usr-bad-1",
    message: "Missing required field: email",
    retryable: true,
    resolvedAt: null,
  });
}

export function _resetSisStore(): void {
  globalThis.__aivoSisStore = undefined;
}
