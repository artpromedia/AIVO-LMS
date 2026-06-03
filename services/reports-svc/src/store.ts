/**
 * In-memory store for report runs, schedules, the result cache, and per-tenant
 * daily quota counters (Sprint 10). The authoritative schema lives in
 * src/db/migrations/*.sql; a DB-backed implementation mirrors this interface.
 */
import { randomUUID } from "node:crypto";
import { createHash } from "node:crypto";
import type { ReportFormat } from "./registry/types.js";
import type { RunLineage } from "./lineage.js";

export type RunStatus = "queued" | "running" | "succeeded" | "failed";

export interface ReportRun {
  id: string;
  reportId: string;
  tenantId: string | null;
  format: ReportFormat;
  params: Record<string, unknown>;
  status: RunStatus;
  rowCount: number | null;
  error: string | null;
  lineage: RunLineage | null;
  cacheKey: string;
  cached: boolean;
  requestedBy: string;
  createdAt: string;
  completedAt: string | null;
  /** Result bytes + content type, set when succeeded. */
  result?: { buffer: Buffer; contentType: string; extension: string };
}

export interface ReportSchedule {
  id: string;
  reportId: string;
  tenantId: string | null;
  params: Record<string, unknown>;
  cron: string;
  recipients: string[];
  format: ReportFormat;
  createdBy: string;
  createdAt: string;
  lastRunAt: string | null;
}

export interface ReportsStore {
  runs: Map<string, ReportRun>;
  schedules: Map<string, ReportSchedule>;
  /** cacheKey → runId of a fresh successful run. */
  cache: Map<string, { runId: string; expiresAt: number }>;
  /** `${tenantId}:${yyyy-mm-dd}` → count. */
  quota: Map<string, number>;
}

export function createStore(): ReportsStore {
  return { runs: new Map(), schedules: new Map(), cache: new Map(), quota: new Map() };
}

let singleton: ReportsStore | null = null;
export function getStore(): ReportsStore {
  if (!singleton) singleton = createStore();
  return singleton;
}
export function resetStore(): ReportsStore {
  singleton = createStore();
  return singleton;
}

export function runId(): string {
  return `run_${randomUUID()}`;
}
export function scheduleId(): string {
  return `sch_${randomUUID()}`;
}

/** Deterministic cache key for identical (reportId + params + tenant + format). */
export function cacheKeyOf(
  reportId: string,
  params: Record<string, unknown>,
  tenantId: string | null,
  format: ReportFormat,
): string {
  const canonical = JSON.stringify({
    reportId,
    tenantId,
    format,
    params: sortedParams(params),
  });
  return createHash("sha256").update(canonical).digest("hex");
}

function sortedParams(params: Record<string, unknown>): Array<[string, unknown]> {
  return Object.keys(params)
    .sort()
    .map((k) => [k, params[k]] as [string, unknown]);
}

export const DAILY_QUOTA = Number(process.env.REPORTS_DAILY_QUOTA ?? 1000);

export function quotaKey(tenantId: string | null, now = new Date()): string {
  return `${tenantId ?? "_platform"}:${now.toISOString().slice(0, 10)}`;
}

/** Returns the updated count after incrementing, or null if over quota. */
export function incrementQuota(
  store: ReportsStore,
  tenantId: string | null,
  now = new Date(),
): { count: number; ok: boolean; limit: number } {
  const key = quotaKey(tenantId, now);
  const current = store.quota.get(key) ?? 0;
  if (current >= DAILY_QUOTA) {
    return { count: current, ok: false, limit: DAILY_QUOTA };
  }
  const next = current + 1;
  store.quota.set(key, next);
  return { count: next, ok: true, limit: DAILY_QUOTA };
}

export function quotaUsage(
  store: ReportsStore,
  tenantId: string | null,
  now = new Date(),
): { used: number; limit: number } {
  return { used: store.quota.get(quotaKey(tenantId, now)) ?? 0, limit: DAILY_QUOTA };
}
