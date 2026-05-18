/**
 * Sprint 7 — fleet-wide watchdog. (Tasks #59, #68)
 *
 * On a fixed cadence, walks every registered job and pages on-call when a
 * job's last_finished_at is older than `1.5 × periodMs`. Dedup is handled by
 * `@aivo/ops-alert` so a job that's been silent for days only pages once per
 * dedupWindowMs.
 *
 * The watchdog is generic — it doesn't know about billing specifically, it
 * walks the full registry. That replaces the original billing-only
 * `BILLING_DAILY_WATCHDOG_WEBHOOK_URL` plumbing (Task #69) with a single
 * `OPS_ALERT_*` config.
 */
import { sql } from "drizzle-orm";
import { JOB_REGISTRY, computeFreshness } from "@aivo/scheduling";
import {
  LegacyOpsAlertClient,
  type OpsAlertClient,
  type LegacyOpsAlert,
  type LegacyOpsAlertSendResult,
} from "@aivo/ops-alerts";
import { makeFreshnessWatchdogDiscoveryStore } from "./freshness-discovery.js";

// ── Alerts client wiring ──────────────────────────────────────────────────
//
// v2.1 §9.1 dedup: we used to import `getOpsAlertClient` from the legacy
// `@aivo/ops-alert` package. Now we wrap the new durable `OpsAlertClient`
// (created by `bootstrapOpsAlerts` in admin-svc/index.ts) in
// `LegacyOpsAlertClient` so this file's `alerts.send({title, body, dedupKey,
// fields})` payloads keep working and we still get per-key TTL dedup.

interface MinimalAlertsClient {
  send(alert: LegacyOpsAlert): Promise<LegacyOpsAlertSendResult>;
}

let injectedAlerts: MinimalAlertsClient | null = null;

/**
 * Wires the watchdog to the process-wide `OpsAlertClient` produced by
 * `bootstrapOpsAlerts`. Should be called once at admin-svc start.
 */
export function configureWatchdogAlerts(client: OpsAlertClient): void {
  injectedAlerts = new LegacyOpsAlertClient({ client });
}

/** Test-only: inject a stubbed alerts client. */
export function _setWatchdogAlertsForTest(client: MinimalAlertsClient | null): void {
  injectedAlerts = client;
}

function getAlerts(): MinimalAlertsClient {
  if (!injectedAlerts) {
    // Defensive: if someone forgot to call configureWatchdogAlerts() the
    // watchdog tick would otherwise crash. Return a no-op so on-call
    // visibility degrades gracefully (the tick logs the alerts it would
    // have sent via the `log?.warn` calls already in this file).
    return {
      async send(): Promise<LegacyOpsAlertSendResult> {
        return { delivered: false, deduped: false };
      },
    };
  }
  return injectedAlerts;
}

// ── Alert threshold constants (Supplemental A) ────────────────────────────

/** LLM cost (USD) per tenant per day that triggers a WARNING page. */
export const LLM_COST_WARNING_USD = 40;
/** LLM cost (USD) per tenant per day that triggers a CRITICAL page + auto-cap. */
export const LLM_COST_CRITICAL_USD = 80;
/** IEP parse failure rate (0–1) over a 5-minute window that triggers a WARNING. */
export const IEP_PARSE_FAILURE_RATE_WARNING = 0.1;
/** 5xx error rate (0–1) over a 2-minute window that triggers a WARNING. */
export const HTTP_5XX_RATE_WARNING = 0.02;

export interface WatchdogOptions {
  intervalMs?: number;
  log?: {
    info: {
      (msg: string, data?: Record<string, unknown>): void;
      (data: Record<string, unknown>, msg?: string): void;
    };
    warn: {
      (msg: string, data?: Record<string, unknown>): void;
      (data: Record<string, unknown>, msg?: string): void;
    };
    error: {
      (msg: string, data?: Record<string, unknown>): void;
      (data: Record<string, unknown> | Error | unknown, msg?: string): void;
    };
  };
}

const DEFAULT_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

export async function runWatchdogOnce(
  db: any,
  log?: WatchdogOptions["log"],
): Promise<{ alerted: string[]; checked: number; discoveries: number }> {
  const alerts = getAlerts();
  const result = (await db.execute(sql`
    SELECT job_name, last_run_at, last_finished_at, last_status FROM daily_job_runs
  `)) as { rows?: Array<Record<string, any>> } | Array<Record<string, any>>;
  const rows = Array.isArray(result) ? result : (result.rows ?? []);
  const byName = new Map<string, Record<string, any>>();
  for (const r of rows) byName.set(r.job_name, r);

  // Record a fresh observation against the discovery store for every job we
  // walk (registered + unregistered). On-call uses these timestamps to tell
  // "the watchdog is still running for this job" from "this row is stale
  // because no replica has reported in days" (#187).
  const discoveryStore = makeFreshnessWatchdogDiscoveryStore(db);
  const seen = new Set<string>();
  for (const entry of JOB_REGISTRY) seen.add(entry.jobName);
  for (const r of rows) seen.add(r.job_name);
  let discoveries = 0;
  const tickAt = new Date();
  for (const jobName of seen) {
    try {
      await discoveryStore.recordSeen(jobName, tickAt);
      discoveries += 1;
    } catch (e) {
      log?.error({ err: e, jobName }, "watchdog discovery store recordSeen failed");
    }
  }

  const alerted: string[] = [];

  for (const entry of JOB_REGISTRY) {
    const row = byName.get(entry.jobName);
    const report = computeFreshness({
      jobName: entry.jobName,
      periodMs: entry.periodMs,
      lastRunAt: row?.last_run_at ? new Date(row.last_run_at) : null,
      lastFinishedAt: row?.last_finished_at ? new Date(row.last_finished_at) : null,
      lastStatus: row?.last_status ?? null,
    });
    if (report.status === "stale" || report.status === "never_run" || report.failed) {
      alerted.push(entry.jobName);
      const ageHours = report.ageMs ? Math.round(report.ageMs / (60 * 60 * 1000)) : null;
      const sev = report.status === "stale" ? "critical" : report.failed ? "critical" : "warning";
      try {
        await alerts.send({
          severity: sev,
          title: `Background job stale: ${entry.jobName}`,
          body:
            report.status === "never_run"
              ? `Job ${entry.jobName} has never been recorded as running on this database.`
              : report.failed
                ? `Job ${entry.jobName} reported status=failed at last finish.`
                : `Job ${entry.jobName} hasn't reported a finish in ~${ageHours}h (expected every ${Math.round(entry.periodMs / 3600_000)}h).`,
          dedupKey: `job-stale:${entry.jobName}`,
          fields: {
            service: entry.service,
            lastFinishedAt: row?.last_finished_at ?? null,
            lastStatus: row?.last_status ?? null,
            ageHours,
          },
        });
      } catch (e) {
        log?.error({ err: e, jobName: entry.jobName }, "watchdog send failed");
      }
    }
  }

  return { alerted, checked: JOB_REGISTRY.length, discoveries };
}

// ── Domain-specific alert helpers (Supplemental A) ────────────────────────

/**
 * Trigger the brain-svc auto-cap endpoint to pause LLM calls for a tenant.
 * Called by `checkLlmCostAlerts` after a CRITICAL alert. Idempotent — the
 * brain-svc endpoint should treat repeated POSTs as a no-op when the tenant
 * is already paused. Failures are logged but do NOT throw, so a brain-svc
 * outage cannot break the watchdog tick that already paged on-call.
 */
async function triggerBrainSvcLlmPause(
  tenantId: string,
  costUsd: number,
  log?: WatchdogOptions["log"],
): Promise<void> {
  const brainSvcUrl = process.env.BRAIN_SVC_URL;
  if (!brainSvcUrl) {
    log?.warn({ tenantId }, "LLM auto-cap skipped: BRAIN_SVC_URL not configured");
    return;
  }
  const internalToken =
    process.env.INTERNAL_SERVICE_TOKEN || process.env.INTERNAL_SERVICE_KEY || "";
  try {
    const res = await fetch(`${brainSvcUrl}/api/brain/admin/pause-llm`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-internal-service": "admin-svc",
        ...(internalToken ? { "x-service-token": internalToken } : {}),
      },
      body: JSON.stringify({
        tenantId,
        reason: "llm_cost_critical",
        costUsd,
        threshold: LLM_COST_CRITICAL_USD,
      }),
    });
    if (!res.ok) {
      log?.error({ tenantId, status: res.status }, "LLM auto-cap brain-svc returned non-2xx");
    } else {
      log?.warn({ tenantId, costUsd }, "LLM auto-cap engaged via brain-svc");
    }
  } catch (e) {
    log?.error({ err: e, tenantId }, "LLM auto-cap brain-svc call failed");
  }
}

/**
 * Check per-tenant LLM daily spend and page if over threshold.
 * `tenantSpend` is a map of tenantId → USD spent today.
 */
export async function checkLlmCostAlerts(
  tenantSpend: Map<string, number>,
  log?: WatchdogOptions["log"],
): Promise<void> {
  const alerts = getAlerts();
  for (const [tenantId, costUsd] of tenantSpend) {
    if (costUsd >= LLM_COST_CRITICAL_USD) {
      log?.warn({ tenantId, costUsd }, "LLM cost CRITICAL threshold reached");
      await alerts
        .send({
          severity: "critical",
          title: `LLM budget critical: tenant ${tenantId}`,
          body: `Tenant ${tenantId} has spent $${costUsd.toFixed(2)} on LLM calls today (threshold: $${LLM_COST_CRITICAL_USD}).`,
          dedupKey: `llm-cost-critical:${tenantId}:${new Date().toISOString().slice(0, 10)}`,
          fields: {
            tenantId,
            costUsd: costUsd.toFixed(2),
            threshold: String(LLM_COST_CRITICAL_USD),
          },
        })
        .catch((e: unknown) => log?.error({ err: e }, "llm cost alert send failed"));
      // Auto-cap: pause LLM for the offending tenant via brain-svc so
      // costs stop accruing while ops investigates. This MUST run after
      // the alert send so an on-call human is aware of the pause.
      await triggerBrainSvcLlmPause(tenantId, costUsd, log);
    } else if (costUsd >= LLM_COST_WARNING_USD) {
      log?.warn({ tenantId, costUsd }, "LLM cost WARNING threshold reached");
      await alerts
        .send({
          severity: "warning",
          title: `LLM budget warning: tenant ${tenantId}`,
          body: `Tenant ${tenantId} has spent $${costUsd.toFixed(2)} on LLM calls today (threshold: $${LLM_COST_WARNING_USD}).`,
          dedupKey: `llm-cost-warning:${tenantId}:${new Date().toISOString().slice(0, 10)}`,
          fields: {
            tenantId,
            costUsd: costUsd.toFixed(2),
            threshold: String(LLM_COST_WARNING_USD),
          },
        })
        .catch((e: unknown) => log?.error({ err: e }, "llm cost alert send failed"));
    }
  }
}

/**
 * Check IEP parse failure rate. If failRate > IEP_PARSE_FAILURE_RATE_WARNING, page.
 * @param total Total IEP parse attempts in the window.
 * @param failed Failed IEP parse attempts in the window.
 */
export async function checkIepParseFailureRate(
  total: number,
  failed: number,
  log?: WatchdogOptions["log"],
): Promise<void> {
  if (total === 0) return;
  const rate = failed / total;
  if (rate > IEP_PARSE_FAILURE_RATE_WARNING) {
    const alerts = getAlerts();
    log?.warn({ rate, failed, total }, "IEP parse failure rate WARNING");
    await alerts
      .send({
        severity: "warning",
        title: "IEP parse failure rate elevated",
        body: `IEP parse failure rate is ${(rate * 100).toFixed(1)}% (${failed}/${total}) in the last 5 minutes.`,
        dedupKey: `iep-parse-failure:${new Date().toISOString().slice(0, 16)}`,
        fields: { rate: rate.toFixed(3), failed: String(failed), total: String(total) },
      })
      .catch((e: unknown) => log?.error({ err: e }, "iep parse alert send failed"));
  }
}

/**
 * Emit a CRITICAL alert immediately when a brain clone fails.
 * Call once per failure event.
 */
export async function alertBrainCloneFailure(
  learnerId: string,
  reason: string,
  log?: WatchdogOptions["log"],
): Promise<void> {
  const alerts = getAlerts();
  log?.error({ learnerId, reason }, "Brain clone CRITICAL failure");
  await alerts
    .send({
      severity: "critical",
      title: `Brain clone failed: learner ${learnerId}`,
      body: `Brain clone pipeline failed for learner ${learnerId}. Reason: ${reason}`,
      dedupKey: `brain-clone-failure:${learnerId}`,
      fields: { learnerId, reason },
    })
    .catch((e: unknown) => log?.error({ err: e }, "brain clone alert send failed"));
}

/**
 * Check HTTP 5xx error rate. If rate > HTTP_5XX_RATE_WARNING, page.
 */
export async function checkHttp5xxRate(
  service: string,
  totalRequests: number,
  errorCount: number,
  windowLabel: string,
  log?: WatchdogOptions["log"],
): Promise<void> {
  if (totalRequests === 0) return;
  const rate = errorCount / totalRequests;
  if (rate > HTTP_5XX_RATE_WARNING) {
    const alerts = getAlerts();
    log?.warn({ service, rate, errorCount, totalRequests }, "HTTP 5xx rate WARNING");
    await alerts
      .send({
        severity: "warning",
        title: `High 5xx rate: ${service}`,
        body: `Service ${service} has a 5xx error rate of ${(rate * 100).toFixed(1)}% (${errorCount}/${totalRequests}) in the last ${windowLabel}.`,
        dedupKey: `5xx-rate:${service}:${new Date().toISOString().slice(0, 16)}`,
        fields: {
          service,
          rate: rate.toFixed(3),
          errorCount: String(errorCount),
          totalRequests: String(totalRequests),
        },
      })
      .catch((e: unknown) => log?.error({ err: e }, "5xx rate alert send failed"));
  }
}

export function startWatchdog(db: any, opts: WatchdogOptions = {}) {
  const intervalMs = opts.intervalMs ?? DEFAULT_INTERVAL_MS;
  const log = opts.log;
  let stopped = false;

  const tick = async () => {
    if (stopped) return;
    try {
      const result = await runWatchdogOnce(db, log);
      log?.info(result, "watchdog tick");
    } catch (e) {
      log?.error({ err: e }, "watchdog tick failed");
    }
  };
  // First tick after a short delay so dev boot stays quick.
  setTimeout(tick, 30_000).unref?.();
  const interval = setInterval(tick, intervalMs);
  if (typeof (interval as { unref?: () => void }).unref === "function") {
    (interval as { unref: () => void }).unref();
  }
  return {
    stop() {
      stopped = true;
      clearInterval(interval);
    },
  };
}
