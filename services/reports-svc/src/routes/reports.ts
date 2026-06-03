/**
 * Reports API (Sprint 10).
 *   GET    /api/reports                       catalog (scope-filtered)
 *   GET    /api/reports/:id/schema            params + columns
 *   POST   /api/reports/:id/run               { params, format } → { runId }
 *   GET    /api/reports/runs/:runId           status + result metadata
 *   GET    /api/reports/runs/:runId/download  streams the file
 *   GET    /api/reports/schedules             list schedules (scoped)
 *   POST   /api/reports/schedules             create schedule
 *   DELETE /api/reports/schedules/:id         delete schedule
 *
 * Reads are scope-filtered; runs enforce scope + tenant-access + per-tenant
 * daily quota (429 on exceedance) and are audited.
 */
import type { FastifyInstance } from "fastify";
import { catalogForScope, getReport, scopeAllows } from "../registry/index.js";
import { resolveCallerScope } from "../scope.js";
import { prepareRun, executeRun } from "../runners/engine.js";
import {
  getStore,
  incrementQuota,
  quotaUsage,
  scheduleId as newScheduleId,
  type ReportSchedule,
} from "../store.js";
import { FORMAT_META } from "../runners/formats.js";
import { emitReportAudit } from "../audit.js";
import type { ReportFormat } from "../registry/types.js";

function isVerifiedRecipient(email: string, allowedDomainsKnown: Set<string>): boolean {
  // Schedules may only target verified recipients within scope. We model
  // verification as membership in the known-recipient set (in production this
  // queries identity-svc for verified emails of users within scope).
  return allowedDomainsKnown.has(email.toLowerCase());
}

export function registerReportRoutes(app: FastifyInstance): void {
  const store = getStore();

  // ── Catalog ───────────────────────────────────────────────────────────
  app.get("/api/reports", async (request, reply) => {
    const caller = resolveCallerScope(request);
    if (!caller.scope) return reply.code(403).send({ error: "No reporting scope" });
    const reports = catalogForScope(caller.scope).map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      category: r.category,
      scopes: r.scopes,
      defaultFormat: r.defaultFormat,
      owner: r.owner,
      lastReviewed: r.lastReviewed,
    }));
    const usage = quotaUsage(store, caller.tenantId ?? null);
    return { reports, quota: usage, scope: caller.scope };
  });

  // ── Schema ────────────────────────────────────────────────────────────
  app.get<{ Params: { id: string } }>("/api/reports/:id/schema", async (request, reply) => {
    const caller = resolveCallerScope(request);
    const def = getReport(request.params.id);
    if (!def) return reply.code(404).send({ error: "Report not found" });
    if (!caller.scope || !scopeAllows(caller.scope, def.scopes)) {
      // Hidden from catalog → 404 to avoid leaking existence to lower scopes.
      return reply.code(404).send({ error: "Report not found" });
    }
    return {
      id: def.id,
      title: def.title,
      description: def.description,
      params: def.params,
      columns: def.columns,
      defaultFormat: def.defaultFormat,
      formats: Object.keys(FORMAT_META),
      allowedTenantIds: caller.allowedTenantIds,
    };
  });

  // ── Run ───────────────────────────────────────────────────────────────
  app.post<{ Params: { id: string }; Body: { params?: Record<string, unknown>; format?: ReportFormat } }>(
    "/api/reports/:id/run",
    async (request, reply) => {
      const caller = resolveCallerScope(request);
      if (!caller.scope) return reply.code(403).send({ error: "No reporting scope" });
      const def = getReport(request.params.id);
      if (!def) return reply.code(404).send({ error: "Report not found" });

      const body = request.body ?? {};
      const input = {
        def,
        rawParams: body.params ?? {},
        format: body.format,
        tenantId: caller.tenantId ?? null,
        allowedTenantIds: caller.allowedTenantIds,
        callerScope: caller.scope,
        requestedBy: caller.actorId ?? "unknown",
      };

      const prepared = prepareRun(input);
      if (!prepared.ok) {
        return reply
          .code(prepared.status)
          .send({ error: prepared.code, errors: prepared.errors });
      }

      // Charge quota only for a request that will actually run.
      const quota = incrementQuota(store, caller.tenantId ?? null);
      if (!quota.ok) {
        return reply
          .code(429)
          .send({ error: "QUOTA_EXCEEDED", limit: quota.limit, used: quota.count });
      }

      const run = await executeRun(input, prepared);

      emitReportAudit({
        action: "report.run",
        actorId: caller.actorId,
        tenantId: caller.tenantId ?? null,
        reportId: def.id,
        resourceId: run.id,
        details: { params: prepared.params, format: prepared.format, cached: run.cached },
      });

      if (run.status === "failed") {
        return reply.code(500).send({ runId: run.id, status: run.status, error: run.error });
      }
      return reply.code(202).send({ runId: run.id, status: run.status, cached: run.cached });
    },
  );

  // ── Run status ──────────────────────────────────────────────────────────
  app.get<{ Params: { runId: string } }>("/api/reports/runs/:runId", async (request, reply) => {
    const caller = resolveCallerScope(request);
    const run = store.runs.get(request.params.runId);
    if (!run) return reply.code(404).send({ error: "Run not found" });
    if (!canAccessRun(caller, run)) return reply.code(403).send({ error: "Forbidden" });
    return {
      runId: run.id,
      reportId: run.reportId,
      status: run.status,
      format: run.format,
      rowCount: run.rowCount,
      cached: run.cached,
      error: run.error,
      lineage: run.lineage,
      createdAt: run.createdAt,
      completedAt: run.completedAt,
      downloadUrl:
        run.status === "succeeded" ? `/api/reports/runs/${run.id}/download` : null,
    };
  });

  // ── Download ──────────────────────────────────────────────────────────
  app.get<{ Params: { runId: string } }>(
    "/api/reports/runs/:runId/download",
    async (request, reply) => {
      const caller = resolveCallerScope(request);
      const run = store.runs.get(request.params.runId);
      if (!run) return reply.code(404).send({ error: "Run not found" });
      if (!canAccessRun(caller, run)) return reply.code(403).send({ error: "Forbidden" });
      if (run.status !== "succeeded" || !run.result) {
        return reply.code(409).send({ error: "Run not ready" });
      }
      emitReportAudit({
        action: "report.download",
        actorId: caller.actorId,
        tenantId: caller.tenantId ?? null,
        reportId: run.reportId,
        resourceId: run.id,
        details: { format: run.format },
      });
      reply
        .header("content-type", run.result.contentType)
        .header(
          "content-disposition",
          `attachment; filename="${run.reportId}-${run.id}.${run.result.extension}"`,
        );
      return reply.send(run.result.buffer);
    },
  );

  // ── Schedules ─────────────────────────────────────────────────────────
  app.get("/api/reports/schedules", async (request, reply) => {
    const caller = resolveCallerScope(request);
    if (!caller.scope) return reply.code(403).send({ error: "No reporting scope" });
    const schedules = [...store.schedules.values()].filter(
      (s) => caller.scope === "platform" || s.tenantId === caller.tenantId,
    );
    return { schedules };
  });

  app.post<{
    Body: {
      reportId?: string;
      params?: Record<string, unknown>;
      cron?: string;
      recipients?: string[];
      format?: ReportFormat;
    };
  }>("/api/reports/schedules", async (request, reply) => {
    const caller = resolveCallerScope(request);
    if (!caller.scope) return reply.code(403).send({ error: "No reporting scope" });
    const body = request.body ?? {};
    if (!body.reportId || !body.cron || !body.recipients?.length) {
      return reply.code(400).send({ error: "reportId, cron, recipients are required" });
    }
    const def = getReport(body.reportId);
    if (!def) return reply.code(404).send({ error: "Report not found" });

    // Scope + tenant-access validation reuses the run preparation logic.
    const prepared = prepareRun({
      def,
      rawParams: body.params ?? {},
      format: body.format,
      tenantId: caller.tenantId ?? null,
      allowedTenantIds: caller.allowedTenantIds,
      callerScope: caller.scope,
      requestedBy: caller.actorId ?? "unknown",
    });
    if (!prepared.ok) {
      return reply.code(prepared.status).send({ error: prepared.code, errors: prepared.errors });
    }

    // Recipients must be verified within scope.
    const verified = new Set(
      (request.headers["x-verified-recipients"]
        ? String(request.headers["x-verified-recipients"]).split(",")
        : caller.allowedTenantIds.flatMap((t) => [`admin@${t}.example`])
      ).map((e) => e.trim().toLowerCase()),
    );
    const invalid = body.recipients.filter((r) => !isVerifiedRecipient(r, verified));
    if (invalid.length) {
      return reply.code(400).send({ error: "UNVERIFIED_RECIPIENTS", recipients: invalid });
    }

    const schedule: ReportSchedule = {
      id: newScheduleId(),
      reportId: def.id,
      tenantId: caller.tenantId ?? null,
      params: prepared.params,
      cron: body.cron,
      recipients: body.recipients,
      format: prepared.format,
      createdBy: caller.actorId ?? "unknown",
      createdAt: new Date().toISOString(),
      lastRunAt: null,
    };
    store.schedules.set(schedule.id, schedule);
    emitReportAudit({
      action: "report.schedule.created",
      actorId: caller.actorId,
      tenantId: caller.tenantId ?? null,
      reportId: def.id,
      resourceId: schedule.id,
      details: { cron: body.cron, recipients: body.recipients.length, format: prepared.format },
    });
    return reply.code(201).send({ schedule });
  });

  app.delete<{ Params: { id: string } }>(
    "/api/reports/schedules/:id",
    async (request, reply) => {
      const caller = resolveCallerScope(request);
      const schedule = store.schedules.get(request.params.id);
      if (!schedule) return reply.code(404).send({ error: "Schedule not found" });
      if (caller.scope !== "platform" && schedule.tenantId !== caller.tenantId) {
        return reply.code(403).send({ error: "Forbidden" });
      }
      store.schedules.delete(schedule.id);
      emitReportAudit({
        action: "report.schedule.deleted",
        actorId: caller.actorId,
        tenantId: caller.tenantId ?? null,
        reportId: schedule.reportId,
        resourceId: schedule.id,
      });
      return { deleted: true };
    },
  );
}

function canAccessRun(
  caller: ReturnType<typeof resolveCallerScope>,
  run: { tenantId: string | null; requestedBy: string },
): boolean {
  if (caller.scope === "platform") return true;
  if (run.tenantId && caller.allowedTenantIds.includes(run.tenantId)) return true;
  return run.requestedBy === caller.actorId;
}
