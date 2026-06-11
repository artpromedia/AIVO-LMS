/**
 * Sprint 10 - admin-svc as the BFF for platform reads.
 *
 * Each `/api/admin-svc/{stats,users,learners,tenants}*` GET proxies to
 * identity-svc with the caller's Bearer token + query string forwarded.
 * This consolidates the read surface so identity-svc can focus on
 * writes; the legacy identity-svc reads remain functional for one
 * deprecation cycle (Deprecation/Sunset headers added on that side).
 *
 * Writes (`PUT /config`) stay local because they target tables owned by
 * admin-svc (`platform_config`). Each config write inserts a new
 * append-only history row; `GET /config/history` returns the trail.
 */
import { FastifyInstance, FastifyReply } from "fastify";
import { adminAuditLog, aiUsageLog, appendAudit, learners, lessonRuns, platformConfig, subscriptions, tenants, users } from "@aivo/db";
import { createLogger } from "@aivo/observability";
import { Permission, verifyJWT } from "@aivo/security";
import { asc, count, desc, eq, gte, sql } from "drizzle-orm";
import { requirePermission } from "../lib/permissions.js";
import { computeTrialConversion } from "../lib/trial-conversion.js";
import { testFaultEnabled } from "./test-helpers.js";
import {
  USAGE_TRENDS_DEFAULT_DAYS,
  buildUsageTrendSeries,
  clampTrendDays,
  trendWindowStart,
} from "../lib/usage-trends.js";
import { logAuditEvent } from "./audit.js";
import { startCsv, EXPORT_ROW_CAP } from "../lib/csv.js";
import {
  adminSvcAiPlaygroundSchema,
  getAdminSvcBillingAccountsSchema,
  getAdminSvcConfigHistorySchema,
  getAdminSvcConfigSchema,
  getAdminSvcLearnersByIdSchema,
  getAdminSvcLearnersSchema,
  getAdminSvcPlatformAiActivitySchema,
  getAdminSvcPlatformAiCostsSchema,
  getAdminSvcPlatformSystemHealthSchema,
  getAdminSvcPlatformUsageTrendsSchema,
  getAdminSvcStatsSchema,
  getAdminSvcTenantsByIdSchema,
  getAdminSvcTenantsSchema,
  getAdminSvcUsersByIdSchema,
  getAdminSvcUsersSchema,
  updateAdminSvcConfigSchema,
} from "./schemas.js";

const IS_PROD = process.env.NODE_ENV === "production";
const DAY_MS = 24 * 60 * 60 * 1000;

const logger = createLogger("admin-svc:platform");

function requireUrl(name: string, devDefault: string): string {
  const v = process.env[name];
  if (v) return v;
  if (IS_PROD) throw new Error(`admin-svc: ${name} must be set in production`);
  return devDefault;
}

const IDENTITY_URL = requireUrl("IDENTITY_SVC_URL", "http://localhost:3001");
const AI_URL = requireUrl("AI_SVC_URL", "http://localhost:3004");
const BRAIN_URL = requireUrl("BRAIN_SVC_URL", "http://localhost:8000");
const INTERNAL_SERVICE_TOKEN =
  process.env.INTERNAL_SERVICE_TOKEN || process.env.INTERNAL_SERVICE_KEY || null;

async function requireAdmin(req: any, reply: any) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return reply.status(401).send({ error: "Missing authorization header" });
  }
  try {
    const payload = await verifyJWT(auth.slice(7));
    if (!["PLATFORM_ADMIN", "DISTRICT_ADMIN"].includes(payload.role as string)) {
      return reply.status(403).send({ error: "Admin access required" });
    }
    req.user = payload;
  } catch {
    return reply.status(401).send({ error: "Invalid token" });
  }
}

/**
 * Forward the request to identity-svc preserving auth, query string,
 * and content-type. The downstream JSON body is streamed back as-is so
 * pagination and shape stay identical to the legacy endpoints.
 */
async function proxyToIdentity(req: any, reply: FastifyReply, downstreamPath: string) {
  const url = new URL(downstreamPath, IDENTITY_URL);
  const incoming = (req.raw?.url || req.url || "") as string;
  const qIdx = incoming.indexOf("?");
  if (qIdx >= 0) url.search = incoming.slice(qIdx);
  let res: Response;
  try {
    res = await fetch(url, {
      method: req.method,
      headers: {
        authorization: req.headers.authorization,
        "content-type": (req.headers["content-type"] as string) || "application/json",
      },
      signal: AbortSignal.timeout(8000),
    });
  } catch (e: any) {
    req.log?.error({ err: e?.message, downstreamPath }, "identity-svc proxy failed");
    return reply.status(502).send({ error: "Upstream identity-svc unavailable" });
  }

  reply.status(res.status);
  const ct = res.headers.get("content-type");
  if (ct) reply.header("content-type", ct);
  return reply.send(await res.text());
}

function normalizeBillingStatus(value: string | null | undefined): string {
  switch ((value ?? "").toLowerCase()) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
    case "past due":
    case "unpaid":
    case "incomplete":
    case "incomplete_expired":
      return "past_due";
    case "cancelled":
    case "canceled":
      return "canceled";
    default:
      return value?.toLowerCase() ?? "unknown";
  }
}

type AiBudgetSnapshot = {
  budgetAvailable: boolean;
  tenantId: string;
  day: string | null;
  spendCents: number | null;
  spendUsd: number | null;
  warnCents: number | null;
  warnUsd: number | null;
  capCents: number | null;
  capUsd: number | null;
  completionCount: number | null;
  blockedCount: number | null;
  warned: boolean;
  exceeded: boolean;
  error: string | null;
};

type AiCostUsage = {
  requestCount: number;
  estimatedCostUsd: number;
  inputTokens: number;
  outputTokens: number;
  avgLatencyMs: number;
};

type AiCostRow = {
  tenantId: string | null;
  requestCount: number | string | null;
  estimatedCostUsd: number | string | null;
  inputTokens: number | string | null;
  outputTokens: number | string | null;
  avgLatencyMs: number | string | null;
};

type AiCostTenantRow = {
  id: string;
  name: string | null;
  type: string | null;
};

async function fetchAiBudgetSnapshot(tenantId: string): Promise<AiBudgetSnapshot> {
  if (!INTERNAL_SERVICE_TOKEN) {
    return {
      budgetAvailable: false,
      tenantId,
      day: null,
      spendCents: null,
      spendUsd: null,
      warnCents: null,
      warnUsd: null,
      capCents: null,
      capUsd: null,
      completionCount: null,
      blockedCount: null,
      warned: false,
      exceeded: false,
      error: "INTERNAL_SERVICE_TOKEN not configured",
    };
  }

  const url = new URL(`/api/ai/admin/budget/${encodeURIComponent(tenantId)}`, AI_URL);
  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        "x-internal-service-token": INTERNAL_SERVICE_TOKEN,
      },
      signal: AbortSignal.timeout(5000),
    });
  } catch (error: any) {
    return {
      budgetAvailable: false,
      tenantId,
      day: null,
      spendCents: null,
      spendUsd: null,
      warnCents: null,
      warnUsd: null,
      capCents: null,
      capUsd: null,
      completionCount: null,
      blockedCount: null,
      warned: false,
      exceeded: false,
      error: error?.message ?? "ai-svc unavailable",
    };
  }

  let payload: Record<string, unknown> | null = null;
  try {
    payload = (await response.json()) as Record<string, unknown>;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const errorMessage =
      typeof payload?.detail === "string"
        ? payload.detail
        : typeof payload?.error === "string"
          ? payload.error
          : `ai-svc budget request failed (${response.status})`;
    return {
      budgetAvailable: false,
      tenantId,
      day: null,
      spendCents: null,
      spendUsd: null,
      warnCents: null,
      warnUsd: null,
      capCents: null,
      capUsd: null,
      completionCount: null,
      blockedCount: null,
      warned: false,
      exceeded: false,
      error: errorMessage,
    };
  }

  return {
    budgetAvailable: true,
    tenantId: String(payload?.tenant_id ?? tenantId),
    day: payload?.day ? String(payload.day) : null,
    spendCents: Number(payload?.spend_cents ?? 0),
    spendUsd: Number(payload?.spend_usd ?? 0),
    warnCents: Number(payload?.warn_cents ?? 0),
    warnUsd: Number(payload?.warn_usd ?? 0),
    capCents: Number(payload?.cap_cents ?? 0),
    capUsd: Number(payload?.cap_usd ?? 0),
    completionCount: Number(payload?.completion_count ?? 0),
    blockedCount: Number(payload?.blocked_count ?? 0),
    warned: Boolean(payload?.warned),
    exceeded: Boolean(payload?.exceeded),
    error: null,
  };
}

type SystemHealthIssue = { source: string; error: string };

/**
 * Drizzle wraps query failures in DrizzleQueryError whose own message is the
 * full SQL text; the actionable part ("relation \"ai_usage_log\" does not
 * exist", "connect ECONNREFUSED ...") lives on `cause`.
 */
function describeDbError(error: unknown): string {
  if (error instanceof Error) {
    const cause = (error as Error & { cause?: unknown }).cause;
    if (cause instanceof Error && cause.message) return cause.message;
    return (error.message.split("\n")[0] || error.message).slice(0, 300);
  }
  return String(error).slice(0, 300);
}

export function registerPlatformRoutes(app: FastifyInstance, db: any) {
  app.get(
    "/api/admin-svc/stats",
    {
      schema: getAdminSvcStatsSchema,
      preHandler: (req, reply) => requirePermission(req, reply, Permission.PlatformRead),
    },
    async (req, reply) => proxyToIdentity(req, reply, "/api/admin/stats"),
  );

  app.get(
    "/api/admin-svc/platform/system-health",
    {
      schema: getAdminSvcPlatformSystemHealthSchema,
      preHandler: (req, reply) => requirePermission(req, reply, Permission.PlatformRead),
    },
    async (req, reply) => {
      // e2e fault injection (ADMIN_TEST_MODE only): lets the dashboard spec
      // prove per-widget degradation without stubbing the UI.
      if (testFaultEnabled("system-health")) {
        return reply.status(503).send({ error: "injected_fault" });
      }
      // The dashboard aggregates five independent domains. One broken read
      // (missing table after a partial migration, a dropped grant, …) must
      // degrade that signal — not 500 the whole landing page. Failures are
      // logged here and named per-source in the response so the console can
      // say exactly what is broken.
      const issues: SystemHealthIssue[] = [];
      const read = async <T>(source: string, fallback: T, run: () => Promise<T>): Promise<T> => {
        try {
          return await run();
        } catch (error) {
          const detail = describeDbError(error);
          logger.error("system-health read failed", {
            source,
            err: detail,
            request_id: (req as any).requestId,
          });
          issues.push({ source, error: detail });
          return fallback;
        }
      };

      const since = new Date(Date.now() - DAY_MS);
      const [tenantTypeRows, userTotal, learnerTotal, lessonStats, aiSummary] = await Promise.all([
        read<Array<{ type: string | null; count: number | string | null }>>("tenants", [], () =>
          db.select({ type: tenants.type, count: count() }).from(tenants).groupBy(tenants.type),
        ),
        read<number | null>("users", null, async () => {
          const [row] = await db.select({ count: count() }).from(users);
          return Number(row?.count ?? 0);
        }),
        read<number | null>("learners", null, async () => {
          const [row] = await db.select({ count: count() }).from(learners);
          return Number(row?.count ?? 0);
        }),
        read<{ total: number; completed: number } | null>("lesson_runs", null, async () => {
          const [total] = await db.select({ count: count() }).from(lessonRuns);
          const [completed] = await db
            .select({ count: count() })
            .from(lessonRuns)
            .where(eq(lessonRuns.status, "completed"));
          return { total: Number(total?.count ?? 0), completed: Number(completed?.count ?? 0) };
        }),
        read<Record<string, unknown> | null>("ai_usage", null, async () => {
          const [row] = await db
            .select({
              requestCount: count(),
              modelsActive: sql<number>`count(distinct ${aiUsageLog.model})`,
              avgLatencyMs: sql<number>`coalesce(round(avg(${aiUsageLog.latencyMs})), 0)`,
              estimatedCostUsd: sql<string>`coalesce(sum(${aiUsageLog.estimatedCostUsd}), 0)`,
            })
            .from(aiUsageLog)
            .where(gte(aiUsageLog.createdAt, since));
          return row ?? {};
        }),
      ]);

      if (issues.length === 5) {
        // Nothing readable — almost certainly the DB itself (bad
        // DATABASE_URL, connection refused). Stay a hard failure, but a
        // diagnosable one.
        return reply.status(503).send({
          error: "system_health_unavailable",
          detail: issues[0]?.error,
          issues,
        });
      }

      const tenantCounts = {
        district: 0,
        school: 0,
        family: 0,
        unknown: 0,
      };
      for (const row of tenantTypeRows) {
        const nextCount = Number(row.count ?? 0);
        if (row.type === "B2B_DISTRICT") tenantCounts.district += nextCount;
        else if (row.type === "B2B_SCHOOL") tenantCounts.school += nextCount;
        else if (row.type === "B2C_FAMILY") tenantCounts.family += nextCount;
        else tenantCounts.unknown += nextCount;
      }

      return {
        tenantCounts,
        tenantsTotal:
          tenantCounts.district + tenantCounts.school + tenantCounts.family + tenantCounts.unknown,
        usersTotal: userTotal ?? 0,
        learnersTotal: learnerTotal ?? 0,
        lessonRunsTotal: lessonStats?.total ?? 0,
        lessonRunsCompleted: lessonStats?.completed ?? 0,
        aiRequests24h: Number(aiSummary?.requestCount ?? 0),
        aiModelsActive24h: Number(aiSummary?.modelsActive ?? 0),
        aiAvgLatencyMs24h: Number(aiSummary?.avgLatencyMs ?? 0),
        aiEstimatedCostUsd24h: Number(aiSummary?.estimatedCostUsd ?? 0),
        degraded: issues.length > 0,
        issues,
      };
    },
  );

  app.get(
    "/api/admin-svc/platform/usage-trends",
    {
      schema: getAdminSvcPlatformUsageTrendsSchema,
      preHandler: (req, reply) => requirePermission(req, reply, Permission.PlatformRead),
    },
    async (req) => {
      const { days: daysStr } = req.query as { days?: string };
      const days = clampTrendDays(daysStr ?? USAGE_TRENDS_DEFAULT_DAYS);
      const now = new Date();
      const since = trendWindowStart(days, now);

      const userDay = sql<string>`to_char(date_trunc('day', ${users.createdAt}), 'YYYY-MM-DD')`;
      const userRows = await db
        .select({ day: userDay, count: count() })
        .from(users)
        .where(gte(users.createdAt, since))
        .groupBy(userDay);

      const learnerDay = sql<string>`to_char(date_trunc('day', ${learners.createdAt}), 'YYYY-MM-DD')`;
      const learnerRows = await db
        .select({ day: learnerDay, count: count() })
        .from(learners)
        .where(gte(learners.createdAt, since))
        .groupBy(learnerDay);

      return {
        days,
        generatedAt: now.toISOString(),
        points: buildUsageTrendSeries({ days, now, users: userRows, learners: learnerRows }),
      };
    },
  );

  app.get(
    "/api/admin-svc/platform/ai-activity",
    {
      schema: getAdminSvcPlatformAiActivitySchema,
      preHandler: (req, reply) => requirePermission(req, reply, Permission.AiRead),
    },
    async (req) => {
      const { limit: limitStr } = req.query as { limit?: string };
      const limit = Math.max(1, Math.min(200, Number(limitStr ?? "8") || 8));
      const entries = await db
        .select({
          id: aiUsageLog.id,
          provider: aiUsageLog.provider,
          model: aiUsageLog.model,
          inputTokens: aiUsageLog.inputTokens,
          outputTokens: aiUsageLog.outputTokens,
          latencyMs: aiUsageLog.latencyMs,
          estimatedCostUsd: aiUsageLog.estimatedCostUsd,
          learnerId: aiUsageLog.learnerId,
          tenantId: learners.tenantId,
          tenantName: tenants.name,
          createdAt: aiUsageLog.createdAt,
        })
        .from(aiUsageLog)
        .leftJoin(learners, eq(aiUsageLog.learnerId, learners.id))
        .leftJoin(tenants, eq(learners.tenantId, tenants.id))
        .orderBy(desc(aiUsageLog.createdAt))
        .limit(limit);
      return { entries, limit };
    },
  );

  app.get(
    "/api/admin-svc/platform/ai-costs",
    {
      schema: getAdminSvcPlatformAiCostsSchema,
      preHandler: (req, reply) => requirePermission(req, reply, Permission.AiRead),
    },
    async (req) => {
      const { limit: limitStr } = req.query as { limit?: string };
      const limit = Math.max(1, Math.min(100, Number(limitStr ?? "50") || 50));
      const since = new Date(Date.now() - DAY_MS);

      const tenantRows = await db
        .select({
          id: tenants.id,
          name: tenants.name,
          type: tenants.type,
        })
        .from(tenants)
        .orderBy(asc(tenants.name));

      const aiCostRows = await db
        .select({
          tenantId: learners.tenantId,
          requestCount: count(),
          estimatedCostUsd: sql<string>`coalesce(sum(${aiUsageLog.estimatedCostUsd}), 0)`,
          inputTokens: sql<string>`coalesce(sum(${aiUsageLog.inputTokens}), 0)`,
          outputTokens: sql<string>`coalesce(sum(${aiUsageLog.outputTokens}), 0)`,
          avgLatencyMs: sql<number>`coalesce(round(avg(${aiUsageLog.latencyMs})), 0)`,
        })
        .from(aiUsageLog)
        .leftJoin(learners, eq(aiUsageLog.learnerId, learners.id))
        .where(gte(aiUsageLog.createdAt, since))
        .groupBy(learners.tenantId);

      const recentEvents = await db
        .select({
          id: aiUsageLog.id,
          provider: aiUsageLog.provider,
          model: aiUsageLog.model,
          inputTokens: aiUsageLog.inputTokens,
          outputTokens: aiUsageLog.outputTokens,
          latencyMs: aiUsageLog.latencyMs,
          estimatedCostUsd: aiUsageLog.estimatedCostUsd,
          learnerId: aiUsageLog.learnerId,
          tenantId: learners.tenantId,
          tenantName: tenants.name,
          createdAt: aiUsageLog.createdAt,
        })
        .from(aiUsageLog)
        .leftJoin(learners, eq(aiUsageLog.learnerId, learners.id))
        .leftJoin(tenants, eq(learners.tenantId, tenants.id))
        .orderBy(desc(aiUsageLog.createdAt))
        .limit(limit);

      const costByTenant = new Map<string, AiCostUsage>(
        (aiCostRows as AiCostRow[]).map((row): [string, AiCostUsage] => [
          String(row.tenantId ?? "__unknown__"),
          {
            requestCount: Number(row.requestCount ?? 0),
            estimatedCostUsd: Number(row.estimatedCostUsd ?? 0),
            inputTokens: Number(row.inputTokens ?? 0),
            outputTokens: Number(row.outputTokens ?? 0),
            avgLatencyMs: Number(row.avgLatencyMs ?? 0),
          },
        ]),
      );

      const tenantBudgets = await Promise.all(
        (tenantRows as AiCostTenantRow[]).map(async (tenant) => ({
          tenant,
          budget: await fetchAiBudgetSnapshot(String(tenant.id)),
        })),
      );

      const tenantSummaries = tenantBudgets.map(({ tenant, budget }) => {
        const usage = costByTenant.get(String(tenant.id)) ?? {
          requestCount: 0,
          estimatedCostUsd: 0,
          inputTokens: 0,
          outputTokens: 0,
          avgLatencyMs: 0,
        };
        return {
          tenantId: tenant.id,
          tenantName: tenant.name,
          tenantType: tenant.type,
          requestCount24h: usage.requestCount,
          estimatedCostUsd24h: usage.estimatedCostUsd,
          inputTokens24h: usage.inputTokens,
          outputTokens24h: usage.outputTokens,
          avgLatencyMs24h: usage.avgLatencyMs,
          budget,
        };
      });

      const totalEstimatedCostUsd24h = tenantSummaries.reduce(
        (sum, tenant) => sum + tenant.estimatedCostUsd24h,
        0,
      );
      const requestCount24h = tenantSummaries.reduce(
        (sum, tenant) => sum + tenant.requestCount24h,
        0,
      );
      const activeTenants24h = tenantSummaries.filter(
        (tenant) => tenant.requestCount24h > 0,
      ).length;
      const warningTenants = tenantSummaries.filter((tenant) => tenant.budget.warned).length;
      const overCapTenants = tenantSummaries.filter((tenant) => tenant.budget.exceeded).length;
      const budgetsAvailable = tenantSummaries.filter(
        (tenant) => tenant.budget.budgetAvailable,
      ).length;

      return {
        summary: {
          totalEstimatedCostUsd24h,
          requestCount24h,
          activeTenants24h,
          warningTenants,
          overCapTenants,
          trackedTenants: tenantSummaries.length,
          budgetsAvailable,
        },
        tenants: tenantSummaries,
        events: recentEvents,
      };
    },
  );

  app.get(
    "/api/admin-svc/users",
    {
      schema: getAdminSvcUsersSchema,
      preHandler: (req, reply) => requirePermission(req, reply, Permission.UserRead),
    },
    async (req, reply) => proxyToIdentity(req, reply, "/api/admin/users"),
  );
  app.get(
    "/api/admin-svc/users/:id",
    {
      schema: getAdminSvcUsersByIdSchema,
      preHandler: (req, reply) => requirePermission(req, reply, Permission.UserRead),
    },
    async (req: any, reply) =>
      proxyToIdentity(req, reply, `/api/admin/users/${encodeURIComponent(req.params.id)}`),
  );

  app.get(
    "/api/admin-svc/learners",
    {
      schema: getAdminSvcLearnersSchema,
      preHandler: (req, reply) => requirePermission(req, reply, Permission.LearnerRead),
    },
    async (req, reply) => proxyToIdentity(req, reply, "/api/admin/learners"),
  );
  app.get(
    "/api/admin-svc/learners/:id",
    {
      schema: getAdminSvcLearnersByIdSchema,
      preHandler: (req, reply) => requirePermission(req, reply, Permission.LearnerRead),
    },
    async (req: any, reply) =>
      proxyToIdentity(req, reply, `/api/admin/learners/${encodeURIComponent(req.params.id)}`),
  );

  // ── Sprint B3 — audited CSV exports (users / learners) ────────────────
  // Streams the SAME identity-backed dataset the list endpoints serve
  // (search passthrough), capped at EXPORT_ROW_CAP, with the export event
  // appended to the admin audit log BEFORE streaming.
  async function exportIdentityCollection(
    req: any,
    reply: FastifyReply,
    opts: {
      identityPath: string;
      key: string;
      resourceType: string;
      filename: string;
      header: string[];
      mapRow: (row: Record<string, unknown>) => unknown[];
    },
  ) {
    const search = (req.query as any)?.search as string | undefined;
    // Canonical 11-key writer profile (all keys, nulls explicit) so the
    // chain verifier can recompute this row — see audit-chain-verify.ts.
    await appendAudit(db, "admin_audit_log", adminAuditLog, {
      action: "admin.data.exported",
      actorId: req.user?.sub ?? "unknown",
      actorEmail: req.user?.email ?? null,
      actorRole: String(req.user?.role ?? "UNKNOWN"),
      onBehalfOfId: null,
      resourceType: opts.resourceType,
      resourceId: null,
      tenantId: null,
      details: { filters: { search: search ?? null } },
      ipAddress: (req.headers["x-forwarded-for"] as string) || req.ip || null,
      userAgent: (req.headers["user-agent"] as string) || null,
    });
    const write = startCsv(reply, opts.filename, opts.header);
    const pageSize = 200;
    let written = 0;
    for (let page = 1; written < EXPORT_ROW_CAP; page += 1) {
      const url = new URL(opts.identityPath, IDENTITY_URL);
      url.searchParams.set("page", String(page));
      url.searchParams.set("pageSize", String(pageSize));
      if (search) url.searchParams.set("search", search);
      const res = await fetch(url, {
        headers: { authorization: req.headers.authorization as string },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) break;
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      const rows = Array.isArray(json[opts.key]) ? (json[opts.key] as Record<string, unknown>[]) : [];
      for (const row of rows) {
        write(opts.mapRow(row));
        written += 1;
        if (written >= EXPORT_ROW_CAP) break;
      }
      if (rows.length < pageSize) break;
    }
    reply.raw.end();
    return reply;
  }

  app.get(
    "/api/admin-svc/users/export.csv",
    {
      schema: getAdminSvcUsersSchema,
      preHandler: (req, reply) => requirePermission(req, reply, Permission.UserRead),
    },
    async (req: any, reply) =>
      exportIdentityCollection(req, reply, {
        identityPath: "/api/admin/users",
        key: "users",
        resourceType: "users",
        filename: "users.csv",
        header: ["id", "email", "name", "role", "tenantId", "lastLoginAt", "createdAt", "deactivatedAt"],
        mapRow: (row) => [
          row.id,
          row.email,
          row.name,
          row.role,
          row.tenantId,
          row.lastLoginAt,
          row.createdAt,
          row.deactivatedAt,
        ],
      }),
  );

  app.get(
    "/api/admin-svc/learners/export.csv",
    {
      schema: getAdminSvcLearnersSchema,
      preHandler: (req, reply) => requirePermission(req, reply, Permission.LearnerRead),
    },
    async (req: any, reply) =>
      exportIdentityCollection(req, reply, {
        identityPath: "/api/admin/learners",
        key: "learners",
        resourceType: "learners",
        filename: "learners.csv",
        header: ["id", "name", "gradeLevel", "tenantId", "parentId", "createdAt"],
        mapRow: (row) => [row.id, row.name, row.gradeLevel, row.tenantId, row.parentId, row.createdAt],
      }),
  );

  app.get(
    "/api/admin-svc/tenants",
    {
      schema: getAdminSvcTenantsSchema,
      preHandler: (req, reply) => requirePermission(req, reply, Permission.TenantRead),
    },
    async (req, reply) => proxyToIdentity(req, reply, "/api/admin/tenants"),
  );
  app.get(
    "/api/admin-svc/tenants/:id",
    {
      schema: getAdminSvcTenantsByIdSchema,
      preHandler: (req, reply) => requirePermission(req, reply, Permission.TenantRead),
    },
    async (req: any, reply) =>
      proxyToIdentity(req, reply, `/api/admin/tenants/${encodeURIComponent(req.params.id)}`),
  );

  app.get(
    "/api/admin-svc/billing/accounts",
    {
      schema: getAdminSvcBillingAccountsSchema,
      preHandler: (req, reply) => requirePermission(req, reply, Permission.BillingRead),
    },
    async () => {
      const rows = await db
        .select({
          id: subscriptions.id,
          tenantId: subscriptions.tenantId,
          plan: subscriptions.plan,
          status: subscriptions.status,
          stripeStatus: subscriptions.stripeStatus,
          paymentStatus: subscriptions.paymentStatus,
          createdAt: subscriptions.createdAt,
          updatedAt: subscriptions.updatedAt,
          currentPeriodEnd: subscriptions.currentPeriodEnd,
          tenantName: tenants.name,
          tenantType: tenants.type,
        })
        .from(subscriptions)
        .leftJoin(tenants, eq(subscriptions.tenantId, tenants.id))
        .orderBy(desc(subscriptions.updatedAt), desc(subscriptions.createdAt));

      const seen = new Set<string>();
      const accounts: Array<Record<string, unknown>> = [];
      for (const row of rows) {
        const tenantId = String(row.tenantId);
        if (seen.has(tenantId)) continue;
        seen.add(tenantId);
        accounts.push({
          id: row.id,
          tenantId,
          tenantName: row.tenantName,
          tenantType: row.tenantType,
          plan: row.plan,
          status: normalizeBillingStatus(row.stripeStatus ?? row.paymentStatus ?? row.status),
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          currentPeriodEnd: row.currentPeriodEnd,
          paymentStatus: row.paymentStatus,
        });
      }

      return { accounts };
    },
  );

  app.get(
    "/api/admin-svc/billing/trials/conversion",
    { preHandler: (req, reply) => requirePermission(req, reply, Permission.BillingRead) },
    async () => {
      const rows = await db
        .select({
          status: subscriptions.status,
          trialEndsAt: subscriptions.trialEndsAt,
          createdAt: subscriptions.createdAt,
          metadata: subscriptions.metadata,
        })
        .from(subscriptions);
      return computeTrialConversion(
        (rows as any[]).map((r) => ({
          status: r.status as string | null,
          trialEndsAt: r.trialEndsAt as Date | null,
          createdAt: r.createdAt as Date,
          metadata: (r.metadata ?? null) as Record<string, unknown> | null,
        })),
      );
    },
  );

  app.post(
    "/api/admin-svc/ai/playground",
    { schema: adminSvcAiPlaygroundSchema, preHandler: requireAdmin },
    async (req, reply) => {
      const url = new URL("/api/brain/playground", BRAIN_URL);
      let res: Response;
      try {
        res = await fetch(url, {
          method: "POST",
          headers: {
            authorization: req.headers.authorization as string,
            "content-type": "application/json",
          },
          body: JSON.stringify(req.body ?? {}),
          signal: AbortSignal.timeout(60_000),
        });
      } catch (e: any) {
        req.log?.error({ err: e?.message }, "brain-svc playground proxy failed");
        return reply.status(502).send({ error: "Upstream brain-svc unavailable" });
      }
      reply.status(res.status as 200);
      const ct = res.headers.get("content-type");
      if (ct) reply.header("content-type", ct);
      return reply.send(await res.text());
    },
  );

  app.get(
    "/api/admin-svc/config",
    { schema: getAdminSvcConfigSchema, preHandler: requireAdmin },
    async () => {
      const rows = await db
        .select()
        .from(platformConfig)
        .orderBy(desc(platformConfig.createdAt))
        .limit(1);
      if (rows.length > 0) return rows[0].config;
      return {
        features: {
          coLearning: true,
          homeworkHelper: true,
          sensoryProfiles: true,
          transitionPlanning: true,
          languageProfiles: true,
          dataExport: true,
        },
        limits: {
          maxLearnersPerTenant: 50,
          maxTutorSessionMinutes: 60,
          maxFileUploadMb: 10,
        },
      };
    },
  );

  app.put(
    "/api/admin-svc/config",
    { schema: updateAdminSvcConfigSchema, preHandler: requireAdmin },
    async (request) => {
      const { config, changeDescription } = request.body as any;
      const user = (request as any).user;

      await db.insert(platformConfig).values({
        config,
        changedBy: user.sub,
        changeDescription: changeDescription || null,
      });

      await logAuditEvent(db, {
        action: "CONFIG_UPDATED",
        actorId: user.sub,
        actorEmail: user.email || "",
        actorRole: user.role || "",
        resourceType: "platform_config",
        details: { config, changeDescription },
      });

      return { status: "updated", config };
    },
  );

  app.get(
    "/api/admin-svc/config/history",
    { schema: getAdminSvcConfigHistorySchema, preHandler: requireAdmin },
    async () => {
      const rows = await db
        .select({
          id: platformConfig.id,
          config: platformConfig.config,
          changedBy: platformConfig.changedBy,
          changeDescription: platformConfig.changeDescription,
          createdAt: platformConfig.createdAt,
          actorEmail: users.email,
          actorName: users.name,
        })
        .from(platformConfig)
        .leftJoin(users, eq(platformConfig.changedBy, users.id))
        .orderBy(desc(platformConfig.createdAt))
        .limit(200);
      return { history: rows };
    },
  );
}
