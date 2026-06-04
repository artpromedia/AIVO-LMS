/**
 * Sprint 7 — `GET /api/billing/admin/daily-jobs/status`.
 *
 * Surfaces the latest tick from `daily_job_runs` plus a recent-run history
 * from `billing_daily_job_runs`. Optional query params (Task #71) let admins
 * filter the history by status and date range:
 *
 *   ?status=ok|partial|failed   (repeatable)
 *   ?since=<iso>
 *   ?until=<iso>
 *   ?limit=<int>     (default 30, max 200)
 *
 * Auth is the same hand-rolled "Bearer JWT + role===PLATFORM_ADMIN" check
 * used elsewhere in billing-svc admin routes.
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { sql } from "drizzle-orm";
import { verifyJWT } from "@aivo/security";
import { dailyJobsStatusSchema, dailyJobsHistoryCsvSchema } from "./schemas.js";

const VALID_STATUSES = new Set(["ok", "partial", "failed", "running"]);
const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 200;

interface JwtPayload {
  sub: string;
  role: string;
  email?: string;
}

export async function requirePlatformAdmin(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<JwtPayload | null> {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    reply.code(401).send({ error: "missing_bearer_token" });
    return null;
  }
  const token = auth.slice("Bearer ".length).trim();
  try {
    const payload = (await verifyJWT(token)) as JwtPayload;
    if (payload.role !== "PLATFORM_ADMIN") {
      reply.code(403).send({ error: "forbidden", required_role: "PLATFORM_ADMIN" });
      return null;
    }
    return payload;
  } catch {
    reply.code(401).send({ error: "invalid_token" });
    return null;
  }
}

export function parseHistoryFilters(query: Record<string, unknown>) {
  const statusParam = query.status;
  let statuses: string[] | null = null;
  if (Array.isArray(statusParam)) {
    statuses = statusParam.map(String).filter((s) => VALID_STATUSES.has(s));
  } else if (typeof statusParam === "string" && statusParam.length > 0) {
    statuses = statusParam
      .split(",")
      .map((s) => s.trim())
      .filter((s) => VALID_STATUSES.has(s));
  }
  if (statuses && statuses.length === 0) statuses = null;

  const parseDate = (v: unknown): Date | null => {
    if (typeof v !== "string" || !v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const since = parseDate(query.since);
  const until = parseDate(query.until);

  let limit = DEFAULT_LIMIT;
  if (typeof query.limit === "string") {
    const n = Number.parseInt(query.limit, 10);
    if (Number.isFinite(n) && n > 0) limit = Math.min(n, MAX_LIMIT);
  }

  return { statuses, since, until, limit };
}

export function registerDailyJobsRoutes(app: FastifyInstance, db: any) {
  app.get(
    "/api/billing/admin/daily-jobs/status",
    { schema: dailyJobsStatusSchema },
    async (req, reply) => {
      const me = await requirePlatformAdmin(req, reply);
      if (!me) return;

      const filters = parseHistoryFilters(req.query as Record<string, unknown>);

      const latestResult = (await db.execute(sql`
      SELECT job_name, last_run_at, last_finished_at, last_replica_id, last_status,
             last_sent, last_failed, last_error, updated_at
      FROM daily_job_runs
      WHERE job_name = 'billing.daily-expiry-reminders'
    `)) as { rows?: Array<Record<string, any>> } | Array<Record<string, any>>;
      const latestRows = Array.isArray(latestResult) ? latestResult : (latestResult.rows ?? []);
      const latest = latestRows[0] ?? null;

      const conds = [sql`job_name = 'billing.daily-expiry-reminders'`];
      if (filters.statuses && filters.statuses.length > 0) {
        // Use IN(...) with sql.join rather than ANY(${array}); drizzle's sql
        // template can't reliably tag a JS array as a PG text[] parameter,
        // which made `status = ANY($1)` fail at runtime with a 500.
        const list = sql.join(
          filters.statuses.map((s) => sql`${s}`),
          sql`, `,
        );
        conds.push(sql`status IN (${list})`);
      }
      if (filters.since) conds.push(sql`run_at >= ${filters.since}`);
      if (filters.until) conds.push(sql`run_at <= ${filters.until}`);

      let where = conds[0]!;
      for (let i = 1; i < conds.length; i++) {
        where = sql`${where} AND ${conds[i]}`;
      }

      const historyResult = (await db.execute(sql`
      SELECT id, run_at, finished_at, replica_id, status, sent, failed, duration_ms, error
      FROM billing_daily_job_runs
      WHERE ${where}
      ORDER BY run_at DESC
      LIMIT ${filters.limit}
    `)) as { rows?: Array<Record<string, any>> } | Array<Record<string, any>>;
      const historyRows = Array.isArray(historyResult) ? historyResult : (historyResult.rows ?? []);

      return {
        latest: latest
          ? {
              jobName: latest.job_name,
              lastRunAt: latest.last_run_at,
              lastFinishedAt: latest.last_finished_at,
              lastReplicaId: latest.last_replica_id,
              lastStatus: latest.last_status,
              lastSent: latest.last_sent,
              lastFailed: latest.last_failed,
              lastError: latest.last_error,
            }
          : null,
        filters: {
          statuses: filters.statuses,
          since: filters.since?.toISOString() ?? null,
          until: filters.until?.toISOString() ?? null,
          limit: filters.limit,
        },
        history: historyRows.map((r) => ({
          id: r.id,
          runAt: r.run_at,
          finishedAt: r.finished_at,
          replicaId: r.replica_id,
          status: r.status,
          sent: r.sent,
          failed: r.failed,
          durationMs: r.duration_ms,
          error: r.error,
        })),
      };
    },
  );

  // CSV export — same filters, content-type text/csv. (Sprint 7 export ask.)
  app.get(
    "/api/billing/admin/daily-jobs/history.csv",
    { schema: dailyJobsHistoryCsvSchema },
    async (req, reply) => {
      const me = await requirePlatformAdmin(req, reply);
      if (!me) return;

      const filters = parseHistoryFilters(req.query as Record<string, unknown>);
      const conds = [sql`job_name = 'billing.daily-expiry-reminders'`];
      if (filters.statuses && filters.statuses.length > 0) {
        const list = sql.join(
          filters.statuses.map((s) => sql`${s}`),
          sql`, `,
        );
        conds.push(sql`status IN (${list})`);
      }
      if (filters.since) conds.push(sql`run_at >= ${filters.since}`);
      if (filters.until) conds.push(sql`run_at <= ${filters.until}`);
      let where = conds[0]!;
      for (let i = 1; i < conds.length; i++) where = sql`${where} AND ${conds[i]}`;

      const result = (await db.execute(sql`
      SELECT run_at, finished_at, replica_id, status, sent, failed, duration_ms, error
      FROM billing_daily_job_runs
      WHERE ${where}
      ORDER BY run_at DESC
      LIMIT ${filters.limit}
    `)) as { rows?: Array<Record<string, any>> } | Array<Record<string, any>>;
      const rows = Array.isArray(result) ? result : (result.rows ?? []);

      const header = "run_at,finished_at,replica_id,status,sent,failed,duration_ms,error";
      const lines = [header];
      for (const r of rows) {
        const parts = [
          r.run_at instanceof Date ? r.run_at.toISOString() : r.run_at,
          r.finished_at instanceof Date ? r.finished_at.toISOString() : (r.finished_at ?? ""),
          r.replica_id ?? "",
          r.status,
          r.sent ?? "",
          r.failed ?? "",
          r.duration_ms ?? "",
          (r.error ?? "")
            .toString()
            .replace(/[\r\n]+/g, " ")
            .replace(/"/g, '""'),
        ];
        lines.push(parts.map((p) => `"${String(p)}"`).join(","));
      }
      reply.header("content-type", "text/csv; charset=utf-8");
      reply.header("content-disposition", 'attachment; filename="billing-daily-jobs-history.csv"');
      return lines.join("\n");
    },
  );
}
