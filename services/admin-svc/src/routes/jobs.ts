/**
 * Sprint 7 — admin Background Jobs page backing routes.
 *
 *   GET  /api/admin-svc/jobs
 *        Joins the static `JOB_REGISTRY` with the live `daily_job_runs` row so
 *        every registered job appears even if it has never run, and any
 *        `daily_job_runs` row that *isn't* in the registry shows up with
 *        `unregistered: true` (Tasks #67, #77). Also merges the discovery
 *        registry so each job carries `firstSeenAt` / `lastSeenAt` (#187).
 *
 *   GET  /api/admin-svc/jobs/:jobName/runs?limit=20[&since=&until=]
 *        Per-job history slice from `periodic_job_runs` (Task #78). The limit
 *        is clamped to [1, 200]. Optional `since` / `until` ISO timestamps
 *        let on-call narrow the slice for postmortems (#205).
 *
 *   GET  /api/admin-svc/jobs/:jobName/runs.csv?since=&until=
 *        Same data as `/runs` rendered as CSV with the time-range filter
 *        applied server-side (#205).
 *
 *   GET  /api/admin-svc/jobs/runs.csv?since=&until=
 *        Bulk export — every retained run for every job, joined with the
 *        registry, in a single CSV. Quarterly review write-ups need this so
 *        on-call doesn't have to download per-job and concatenate (#206).
 *
 *   POST /api/admin-svc/jobs/:jobName/run-now
 *        Asks the owning service to fire its job out-of-band, still under the
 *        existing advisory lock (Task #76).
 *
 *   GET  /api/admin-svc/jobs/freshness
 *        Single-pane dashboard — every monitored job with a green/red status
 *        derived from `computeFreshness` (Task #80).
 *
 *   DELETE /api/admin-svc/jobs/discovery/:jobName
 *        Drop a row from the freshness watchdog discovery registry. Used to
 *        retire jobs that have been removed from a service but whose stale
 *        `lastSeenAt` still appears in the dashboard (#188).
 */
import type { FastifyInstance } from "fastify";
import { sql } from "drizzle-orm";
import { JOB_REGISTRY, computeFreshness } from "@aivo/scheduling";
import type { JobRegistryEntry } from "@aivo/scheduling";
import { freshnessWatchdogDiscoveries } from "@aivo/db";
import { requirePlatformAdmin } from "../lib/auth.js";
import { eq, lt, and, notInArray } from "drizzle-orm";
import { getAdminSvcJobsSchema, getAdminSvcJobsByJobNameRunsSchema, getAdminSvcJobsByJobNameRunsCsvSchema, getAdminSvcJobsRunsCsvSchema, adminSvcJobsByJobNameRunNowSchema, getAdminSvcJobsFreshnessSchema, deleteAdminSvcJobsDiscoveryByJobNameSchema } from "./schemas.js";

interface RunNowRequester {
  request(jobName: string, owner: JobRegistryEntry): Promise<{ ok: boolean; status?: string; error?: string }>;
}

const defaultRunNowRequester: RunNowRequester = {
  async request(jobName, owner) {
    const baseEnv = `${owner.service.replace(/-/g, "_").toUpperCase()}_URL`;
    const url = process.env[baseEnv];
    if (!url) {
      return { ok: false, error: `no ${baseEnv} configured for ${owner.service}` };
    }
    try {
      const res = await fetch(`${url}/internal/jobs/${encodeURIComponent(jobName)}/run-now`, {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      if (!res.ok) return { ok: false, error: `service returned ${res.status}` };
      const body = (await res.json().catch(() => ({}))) as { status?: string };
      return { ok: true, status: body.status };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  },
};

export interface JobsRoutesDeps {
  runNow?: RunNowRequester;
}

export function registerJobsRoutes(app: FastifyInstance, db: any, deps: JobsRoutesDeps = {}) {
  const runNow = deps.runNow ?? defaultRunNowRequester;

  app.get("/api/admin-svc/jobs", { schema: getAdminSvcJobsSchema }, async (req, reply) => {
    const me = await requirePlatformAdmin(req, reply);
    if (!me) return;

    const ledgerResult = (await db.execute(sql`
      SELECT job_name, last_run_at, last_finished_at, last_replica_id, last_status,
             last_sent, last_failed, last_error
      FROM daily_job_runs
    `)) as { rows?: Array<Record<string, any>> } | Array<Record<string, any>>;
    const ledgerRows = Array.isArray(ledgerResult) ? ledgerResult : (ledgerResult.rows ?? []);
    const byName = new Map<string, Record<string, any>>();
    for (const row of ledgerRows) byName.set(row.job_name, row);

    // Merge in the discovery registry so each row carries the timestamps
    // the watchdog has actually observed (#187). Pull every row up front
    // — there are at most a few dozen — and look up by jobName below.
    const discoveryRows = (await db.execute(sql`
      SELECT job_name, first_seen_at, last_seen_at FROM freshness_watchdog_discoveries
    `)) as { rows?: Array<Record<string, any>> } | Array<Record<string, any>>;
    const discoveryList = Array.isArray(discoveryRows) ? discoveryRows : (discoveryRows.rows ?? []);
    const discoveryByName = new Map<string, { firstSeenAt: Date | null; lastSeenAt: Date | null }>();
    for (const r of discoveryList) {
      discoveryByName.set(r.job_name, {
        firstSeenAt: r.first_seen_at ? new Date(r.first_seen_at) : null,
        lastSeenAt: r.last_seen_at ? new Date(r.last_seen_at) : null,
      });
    }

    const out = JOB_REGISTRY.map((entry) => {
      const row = byName.get(entry.jobName);
      const lastFinishedAt = row?.last_finished_at
        ? new Date(row.last_finished_at)
        : null;
      const lastRunAt = row?.last_run_at ? new Date(row.last_run_at) : null;
      const freshness = computeFreshness({
        jobName: entry.jobName,
        periodMs: entry.periodMs,
        lastRunAt,
        lastFinishedAt,
        lastStatus: row?.last_status ?? null,
      });
      byName.delete(entry.jobName);
      const discovery = discoveryByName.get(entry.jobName);
      return {
        ...entry,
        lastRunAt,
        lastFinishedAt,
        lastReplicaId: row?.last_replica_id ?? null,
        lastStatus: row?.last_status ?? null,
        lastSent: row?.last_sent ?? null,
        lastFailed: row?.last_failed ?? null,
        lastError: row?.last_error ?? null,
        freshness,
        unregistered: false,
        firstSeenAt: discovery?.firstSeenAt ?? null,
        lastSeenAt: discovery?.lastSeenAt ?? null,
      };
    });

    // Anything left in `byName` is a job present in the ledger but not the
    // registry — we still want to surface it so on-call sees the row.
    for (const [jobName, row] of byName) {
      const discovery = discoveryByName.get(jobName);
      out.push({
        jobName,
        service: "(unknown)",
        description: "Job present in ledger but not in JOB_REGISTRY.",
        periodMs: 24 * 60 * 60 * 1000,
        lastRunAt: row.last_run_at ? new Date(row.last_run_at) : null,
        lastFinishedAt: row.last_finished_at ? new Date(row.last_finished_at) : null,
        lastReplicaId: row.last_replica_id ?? null,
        lastStatus: row.last_status ?? null,
        lastSent: row.last_sent ?? null,
        lastFailed: row.last_failed ?? null,
        lastError: row.last_error ?? null,
        freshness: computeFreshness({
          jobName,
          periodMs: 24 * 60 * 60 * 1000,
          lastRunAt: row.last_run_at ? new Date(row.last_run_at) : null,
          lastFinishedAt: row.last_finished_at ? new Date(row.last_finished_at) : null,
          lastStatus: row.last_status ?? null,
        }),
        unregistered: true,
        firstSeenAt: discovery?.firstSeenAt ?? null,
        lastSeenAt: discovery?.lastSeenAt ?? null,
      });
    }

    return { jobs: out };
  });

  app.get("/api/admin-svc/jobs/:jobName/runs", { schema: getAdminSvcJobsByJobNameRunsSchema }, async (req, reply) => {
    const me = await requirePlatformAdmin(req, reply);
    if (!me) return;

    const params = req.params as { jobName: string };
    const { rows, limit, since, until } = await selectJobRuns(db, params.jobName, req.query as Record<string, unknown>);

    return {
      jobName: params.jobName,
      limit,
      since: since ? since.toISOString() : null,
      until: until ? until.toISOString() : null,
      runs: rows.map((r) => ({
        id: r.id,
        runAt: r.run_at,
        finishedAt: r.finished_at,
        replicaId: r.replica_id,
        status: r.status,
        durationMs: r.duration_ms,
        error: r.error,
      })),
    };
  });

  // Per-job CSV export with time-range filtering (#205). Same query shape
  // as /runs but the response is text/csv with a content-disposition so the
  // browser downloads it.
  app.get("/api/admin-svc/jobs/:jobName/runs.csv", { schema: getAdminSvcJobsByJobNameRunsCsvSchema }, async (req, reply) => {
    const me = await requirePlatformAdmin(req, reply);
    if (!me) return;

    const params = req.params as { jobName: string };
    const { rows, since, until } = await selectJobRuns(db, params.jobName, req.query as Record<string, unknown>);
    const filename = csvFilename(`${params.jobName}-runs`, since, until);
    reply.header("content-type", "text/csv; charset=utf-8");
    reply.header("content-disposition", `attachment; filename="${filename}"`);
    return runsToCsv(params.jobName, rows);
  });

  // Bulk export across every retained run for every job (#206). Quarterly
  // review write-ups need a single sheet covering "all watchdog activity in
  // Q1"; without this, on-call has to click each per-job download in turn.
  app.get("/api/admin-svc/jobs/runs.csv", { schema: getAdminSvcJobsRunsCsvSchema }, async (req, reply) => {
    const me = await requirePlatformAdmin(req, reply);
    if (!me) return;

    const query = req.query as Record<string, unknown>;
    const since = parseIsoQueryParam(query.since);
    const until = parseIsoQueryParam(query.until);
    // Same per-job retention applies (rows are pruned to ~50 by the
    // janitor, #178), so the worst-case row count is bounded by
    // JOB_REGISTRY × 50. Streaming a single SELECT across the table is
    // safe.
    const conditions: any[] = [];
    if (since) conditions.push(sql`run_at >= ${since}`);
    if (until) conditions.push(sql`run_at <= ${until}`);
    const where =
      conditions.length === 0
        ? sql`TRUE`
        : conditions.reduce((acc, c, i) => (i === 0 ? c : sql`${acc} AND ${c}`));
    const result = (await db.execute(sql`
      SELECT id, job_name, run_at, finished_at, replica_id, status, duration_ms, error
      FROM periodic_job_runs
      WHERE ${where}
      ORDER BY run_at DESC
      LIMIT 5000
    `)) as { rows?: Array<Record<string, any>> } | Array<Record<string, any>>;
    const rows = Array.isArray(result) ? result : (result.rows ?? []);

    const filename = csvFilename(`all-watchdog-runs`, since, until);
    reply.header("content-type", "text/csv; charset=utf-8");
    reply.header("content-disposition", `attachment; filename="${filename}"`);
    return runsToCsv(null, rows);
  });

  app.post("/api/admin-svc/jobs/:jobName/run-now", { schema: adminSvcJobsByJobNameRunNowSchema }, async (req, reply) => {
    const me = await requirePlatformAdmin(req, reply);
    if (!me) return;
    const params = req.params as { jobName: string };
    const owner = JOB_REGISTRY.find((j) => j.jobName === params.jobName);
    if (!owner) {
      reply.code(404).send({ error: "job_not_registered", jobName: params.jobName });
      return;
    }
    const result = await runNow.request(params.jobName, owner);
    if (!result.ok) {
      reply.code(502).send({ error: "remote_failed", detail: result.error });
      return;
    }
    return { ok: true, status: result.status ?? "queued" };
  });

  app.get("/api/admin-svc/jobs/freshness", { schema: getAdminSvcJobsFreshnessSchema }, async (req, reply) => {
    const me = await requirePlatformAdmin(req, reply);
    if (!me) return;

    const ledgerResult = (await db.execute(sql`
      SELECT job_name, last_run_at, last_finished_at, last_status FROM daily_job_runs
    `)) as { rows?: Array<Record<string, any>> } | Array<Record<string, any>>;
    const ledgerRows = Array.isArray(ledgerResult) ? ledgerResult : (ledgerResult.rows ?? []);
    const byName = new Map<string, Record<string, any>>();
    for (const r of ledgerRows) byName.set(r.job_name, r);

    const reports = JOB_REGISTRY.map((entry) => {
      const row = byName.get(entry.jobName);
      return computeFreshness({
        jobName: entry.jobName,
        periodMs: entry.periodMs,
        lastRunAt: row?.last_run_at ? new Date(row.last_run_at) : null,
        lastFinishedAt: row?.last_finished_at ? new Date(row.last_finished_at) : null,
        lastStatus: row?.last_status ?? null,
      });
    });

    const counts = {
      fresh: reports.filter((r) => r.status === "fresh" && !r.failed).length,
      warning: reports.filter((r) => r.status === "warning").length,
      stale: reports.filter((r) => r.status === "stale").length,
      never_run: reports.filter((r) => r.status === "never_run").length,
      failed: reports.filter((r) => r.failed).length,
    };

    return { generatedAt: new Date().toISOString(), counts, reports };
  });

  // Cleanup endpoint for #188. The discovery registry grows by one row per
  // (service, jobName) pair and never shrinks; when a watchdog is removed
  // from a service, its row sticks around forever with a stale lastSeenAt.
  // On-call uses this DELETE to retire those rows manually.
  app.delete("/api/admin-svc/jobs/discovery/:jobName", { schema: deleteAdminSvcJobsDiscoveryByJobNameSchema }, async (req, reply) => {
    const me = await requirePlatformAdmin(req, reply);
    if (!me) return;
    const params = req.params as { jobName: string };
    const result = await db
      .delete(freshnessWatchdogDiscoveries)
      .where(eq(freshnessWatchdogDiscoveries.jobName, params.jobName))
      .returning({ jobName: freshnessWatchdogDiscoveries.jobName });
    const rows = Array.isArray(result) ? result : ((result as { rows?: any[] }).rows ?? []);
    if (rows.length === 0) {
      reply.code(404).send({ error: "discovery_not_found", jobName: params.jobName });
      return;
    }
    return { ok: true, jobName: params.jobName };
  });
}

interface JobRunsQuery {
  limit?: string;
  since?: string;
  until?: string;
}

async function selectJobRuns(
  db: any,
  jobName: string,
  query: Record<string, unknown>,
): Promise<{ rows: Array<Record<string, any>>; limit: number; since: Date | null; until: Date | null }> {
  const q = query as JobRunsQuery;
  let limit = 200;
  if (typeof q.limit === "string") {
    const n = Number.parseInt(q.limit, 10);
    if (Number.isFinite(n) && n > 0) limit = Math.max(1, Math.min(n, 200));
  }
  const since = parseIsoQueryParam(q.since);
  const until = parseIsoQueryParam(q.until);

  const conditions: any[] = [sql`job_name = ${jobName}`];
  if (since) conditions.push(sql`run_at >= ${since}`);
  if (until) conditions.push(sql`run_at <= ${until}`);
  const where = conditions.reduce((acc, c, i) => (i === 0 ? c : sql`${acc} AND ${c}`));

  const result = (await db.execute(sql`
    SELECT id, run_at, finished_at, replica_id, status, duration_ms, error
    FROM periodic_job_runs
    WHERE ${where}
    ORDER BY run_at DESC
    LIMIT ${limit}
  `)) as { rows?: Array<Record<string, any>> } | Array<Record<string, any>>;
  const rows = Array.isArray(result) ? result : (result.rows ?? []);
  return { rows, limit, since, until };
}

function parseIsoQueryParam(v: unknown): Date | null {
  if (typeof v !== "string" || v.length === 0) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function csvFilename(prefix: string, since: Date | null, until: Date | null): string {
  const today = new Date().toISOString().slice(0, 10);
  const range =
    since && until
      ? `_${since.toISOString().slice(0, 10)}_to_${until.toISOString().slice(0, 10)}`
      : since
        ? `_from_${since.toISOString().slice(0, 10)}`
        : until
          ? `_until_${until.toISOString().slice(0, 10)}`
          : "";
  return `${prefix}${range}_${today}.csv`;
}

function runsToCsv(jobName: string | null, rows: Array<Record<string, any>>): string {
  // Bulk export includes job_name; per-job export omits it (already in the
  // filename and the operator picked the row).
  const includeJobName = jobName === null;
  const header = includeJobName
    ? "job_name,run_at,finished_at,replica_id,status,duration_ms,error"
    : "run_at,finished_at,replica_id,status,duration_ms,error";
  const lines = [header];
  for (const r of rows) {
    const cells: Array<string | number | null> = includeJobName
      ? [r.job_name, r.run_at, r.finished_at, r.replica_id, r.status, r.duration_ms, r.error]
      : [r.run_at, r.finished_at, r.replica_id, r.status, r.duration_ms, r.error];
    lines.push(cells.map(csvCell).join(","));
  }
  return lines.join("\n");
}

function csvCell(v: string | number | Date | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = v instanceof Date ? v.toISOString() : String(v);
  // RFC 4180 quoting only for cells containing comma, quote, or newline.
  if (s.includes(",") || s.includes("\"") || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// Re-export the cleanup helper used by the janitor for orphaned discoveries
// (#188). Job names that the watchdog hasn't observed in `staleAfterMs` and
// that aren't in the static JOB_REGISTRY are dropped automatically.
export async function sweepOrphanedDiscoveries(
  db: any,
  options: { staleAfterMs?: number; now?: Date } = {},
): Promise<{ deleted: number }> {
  const staleAfterMs = options.staleAfterMs ?? 30 * 24 * 60 * 60 * 1000;
  const now = options.now ?? new Date();
  const cutoff = new Date(now.getTime() - staleAfterMs);
  const registryNames = JOB_REGISTRY.map((e) => e.jobName);

  const where =
    registryNames.length > 0
      ? and(
          lt(freshnessWatchdogDiscoveries.lastSeenAt, cutoff),
          notInArray(freshnessWatchdogDiscoveries.jobName, registryNames),
        )
      : lt(freshnessWatchdogDiscoveries.lastSeenAt, cutoff);

  const result = await db
    .delete(freshnessWatchdogDiscoveries)
    .where(where)
    .returning({ jobName: freshnessWatchdogDiscoveries.jobName });
  const rows = Array.isArray(result) ? result : ((result as { rows?: any[] }).rows ?? []);
  return { deleted: rows.length };
}
