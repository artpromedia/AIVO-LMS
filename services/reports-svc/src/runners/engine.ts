/**
 * Run engine (Sprint 10): validate params → check scope/tenant access → cache
 * lookup → resolve rows → capture lineage → encode the requested format →
 * persist the run. Runs inline by default (fast on the seeded dataset, well
 * under the 30s DoD budget); the same `executeRun` is what a BullMQ worker
 * calls per format when REDIS_URL is configured (see ./queue.ts).
 */
import type { ReportDefinition, ReportFormat, ReportScope } from "../registry/types.js";
import { scopeAllows } from "../registry/index.js";
import { captureLineage } from "../lineage.js";
import {
  cacheKeyOf,
  getStore,
  runId as newRunId,
  type ReportRun,
  type ReportsStore,
} from "../store.js";
import { encodeCsv, encodeJson, encodeParquet, FORMAT_META } from "./formats.js";
import { renderReportPdf, type Branding } from "./pdf.js";

export interface ValidateResult {
  ok: boolean;
  params: Record<string, unknown>;
  errors: string[];
}

export function validateParams(
  def: ReportDefinition,
  raw: Record<string, unknown>,
): ValidateResult {
  const errors: string[] = [];
  const params: Record<string, unknown> = {};
  for (const p of def.params) {
    let value = raw[p.name];
    if (value === undefined || value === "") {
      if (p.default !== undefined) value = p.default;
      else if (p.required) {
        errors.push(`Missing required param "${p.name}"`);
        continue;
      } else {
        continue;
      }
    }
    switch (p.type) {
      case "number": {
        const n = Number(value);
        if (Number.isNaN(n)) errors.push(`Param "${p.name}" must be a number`);
        else params[p.name] = n;
        break;
      }
      case "boolean":
        params[p.name] = value === true || value === "true";
        break;
      case "date": {
        const d = new Date(String(value));
        if (Number.isNaN(d.getTime())) errors.push(`Param "${p.name}" must be a date`);
        else params[p.name] = d.toISOString();
        break;
      }
      case "enum":
        if (p.options && !p.options.includes(String(value))) {
          errors.push(`Param "${p.name}" must be one of ${p.options.join(", ")}`);
        } else params[p.name] = String(value);
        break;
      case "tenantId":
      case "string":
      default:
        params[p.name] = String(value);
    }
  }
  return { ok: errors.length === 0, params, errors };
}

export interface RunInput {
  def: ReportDefinition;
  rawParams: Record<string, unknown>;
  format?: ReportFormat;
  tenantId: string | null;
  allowedTenantIds: string[];
  callerScope: ReportScope;
  requestedBy: string;
  store?: ReportsStore;
  branding?: Branding;
  now?: () => number;
}

export type RunOutcome =
  | { ok: true; run: ReportRun }
  | { ok: false; status: number; code: string; errors?: string[] };

/**
 * Validate + authorize a run request without executing it. Returns the prepared
 * params + format + cacheKey, or an error outcome. Used by the route so quota
 * is only charged for a request that will actually run.
 */
export function prepareRun(input: RunInput):
  | { ok: false; status: number; code: string; errors?: string[] }
  | {
      ok: true;
      format: ReportFormat;
      params: Record<string, unknown>;
      cacheKey: string;
    } {
  const { def } = input;

  // Scope: caller may only run a report whose scope ≤ their role's scope.
  if (!scopeAllows(input.callerScope, def.scopes)) {
    return { ok: false, status: 403, code: "SCOPE_FORBIDDEN" };
  }

  const validation = validateParams(def, input.rawParams);
  if (!validation.ok) {
    return { ok: false, status: 400, code: "INVALID_PARAMS", errors: validation.errors };
  }

  // Tenant-access: any tenantId param must be within the caller's allow-list.
  const tenantParam = def.params.find((p) => p.type === "tenantId");
  if (tenantParam) {
    const requested = String(validation.params[tenantParam.name] ?? "");
    if (requested && !input.allowedTenantIds.includes(requested)) {
      return { ok: false, status: 403, code: "TENANT_FORBIDDEN" };
    }
  }

  const format = input.format ?? def.defaultFormat;
  if (!FORMAT_META[format]) {
    return { ok: false, status: 400, code: "INVALID_FORMAT" };
  }

  const cacheKey = cacheKeyOf(def.id, validation.params, input.tenantId, format);
  return { ok: true, format, params: validation.params, cacheKey };
}

/** Execute a fully-prepared run (resolve + encode + persist). */
export async function executeRun(
  input: RunInput,
  prepared: { format: ReportFormat; params: Record<string, unknown>; cacheKey: string },
): Promise<ReportRun> {
  const store = input.store ?? getStore();
  const now = input.now ?? Date.now;
  const { def } = input;

  // Cache hit → return a cached run pointing at the prior result.
  const hit = store.cache.get(prepared.cacheKey);
  if (hit && hit.expiresAt > now()) {
    const prior = store.runs.get(hit.runId);
    if (prior && prior.status === "succeeded") {
      const cachedRun: ReportRun = {
        ...prior,
        id: newRunId(),
        cached: true,
        requestedBy: input.requestedBy,
        createdAt: new Date(now()).toISOString(),
        completedAt: new Date(now()).toISOString(),
      };
      store.runs.set(cachedRun.id, cachedRun);
      return cachedRun;
    }
  }

  const run: ReportRun = {
    id: newRunId(),
    reportId: def.id,
    tenantId: input.tenantId,
    format: prepared.format,
    params: prepared.params,
    status: "running",
    rowCount: null,
    error: null,
    lineage: null,
    cacheKey: prepared.cacheKey,
    cached: false,
    requestedBy: input.requestedBy,
    createdAt: new Date(now()).toISOString(),
    completedAt: null,
  };
  store.runs.set(run.id, run);

  try {
    const result = await def.resolve({
      params: prepared.params,
      allowedTenantIds: input.allowedTenantIds,
      callerScope: input.callerScope,
    });
    const encoded = await encode(def, prepared.format, result.rows, input.branding);
    run.rowCount = result.rows.length;
    run.lineage = captureLineage(def, prepared.params, result.sources);
    run.result = encoded;
    run.status = "succeeded";
    run.completedAt = new Date(now()).toISOString();
    store.cache.set(prepared.cacheKey, {
      runId: run.id,
      expiresAt: now() + def.cacheTtl * 1000,
    });
  } catch (err) {
    run.status = "failed";
    run.error = (err as Error).message;
    run.completedAt = new Date(now()).toISOString();
  }
  store.runs.set(run.id, run);
  return run;
}

async function encode(
  def: ReportDefinition,
  format: ReportFormat,
  rows: Array<Record<string, unknown>>,
  branding: Branding | undefined,
): Promise<{ buffer: Buffer; contentType: string; extension: string }> {
  const meta = FORMAT_META[format];
  if (format === "csv") return { buffer: encodeCsv(def.columns, rows), ...meta };
  if (format === "json") return { buffer: encodeJson(def.columns, rows), ...meta };
  if (format === "parquet") return { buffer: encodeParquet(def.columns, rows), ...meta };
  // pdf
  const pdf = await renderReportPdf(def.title, def.columns, rows, branding ?? {});
  return { buffer: pdf.buffer, contentType: pdf.contentType, extension: meta.extension };
}
