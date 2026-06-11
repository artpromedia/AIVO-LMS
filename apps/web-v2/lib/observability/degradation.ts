/**
 * Wave A (G2) — loud degradation telemetry for the AI personalization
 * ladder.
 *
 * The baseline and lesson generators are deliberately fail-open: any LLM
 * failure (missing service token, 401, timeout, schema mismatch) falls
 * back to bank / deterministic content so a learner is never blocked.
 * Before this module that degradation was SILENT — production could run
 * for weeks on template lessons with nobody paged. Every fallback that
 * means "the learner is not getting the personalization the product
 * promises" must flow through `emitDegradation`, which:
 *
 *   1. writes a structured warn log (all environments),
 *   2. increments the `web_v2_degradation_total` counter (all envs),
 *   3. pages ops via the alerts-proxy outbox (production runtime only),
 *      deduped per (event, reason) so a hot loop cannot alert-storm.
 *
 * Expected steady states are NOT degradations and must not be routed
 * here: the offline question bank serving as the instant first tier,
 * `AIVO_FEATURE_BASELINE_LLM=false` (explicit kill switch), and the
 * "parent assessment not yet submitted" fallback are all by-design.
 * Honest *labeling* of those states is handled separately by
 * `BaselineGenerationMetadata.personalization`
 * (see lib/learner/baseline-provenance.ts).
 */
import { serverEnv } from "@/lib/env";
import { logger } from "@/lib/observability/logger";
import { createCounter } from "@aivo/observability";
import {
  MemoryOpsAlertOutboxStore,
  OpsAlertClient,
  createLegacyOpsAlertClient,
  type LegacyOpsAlert,
  type LegacyOpsAlertSendResult,
} from "@aivo/ops-alerts";

export type DegradationEvent =
  /** The LLM baseline tier was reached and failed; a generic set was served. */
  | "baseline_generic_fallback"
  /** AI_PROVIDER names a real provider but the runtime resolved the mock. */
  | "lesson_provider_mock_in_prod"
  /** The lesson provider exhausted retries; deterministic fallback served. */
  | "lesson_fallback_after_retries";

export type DegradationDetail = {
  /** Machine reason (e.g. `non_2xx`, `timeout`, `missing_api_key`). */
  reason?: string;
  /** Upstream HTTP status when the failure was an HTTP response. */
  status?: number;
  learnerId?: string;
  tenantId?: string;
  baselineId?: string;
  provider?: string;
  /** Human-readable detail forwarded into the alert body. */
  message?: string;
};

const BASE_SEVERITY: Record<DegradationEvent, "warning" | "critical"> = {
  baseline_generic_fallback: "warning",
  lesson_provider_mock_in_prod: "critical",
  lesson_fallback_after_retries: "warning",
};

const counter = createCounter("web_v2_degradation_total", ["event", "reason"]);

type AlertSender = (alert: LegacyOpsAlert) => Promise<LegacyOpsAlertSendResult>;

let alertSender: AlertSender | null = null;
let testSender: AlertSender | null = null;

/**
 * Mirrors the `isProd` runtime detection in lib/env.ts (not exported from
 * there): the `next build` compile phase and AIVO_TEST_MODE must never page.
 */
function isProdRuntime(): boolean {
  return (
    process.env.NODE_ENV === "production" &&
    (process.env.NEXT_PHASE ?? "") !== "phase-production-build" &&
    process.env.AIVO_TEST_MODE !== "1"
  );
}

/**
 * Lazily build the alerts-proxy client on first production emit so dev
 * servers and unit tests never spin up the outbox auto-flush interval.
 */
function getAlertSender(): AlertSender | null {
  if (testSender) return testSender;
  if (!isProdRuntime()) return null;
  if (!alertSender) {
    const client = new OpsAlertClient({
      service: "web-v2",
      proxyUrl: serverEnv.ALERTS_PROXY_SVC_URL,
      outbox: new MemoryOpsAlertOutboxStore(),
    });
    client.startAutoFlush();
    const legacy = createLegacyOpsAlertClient({ client });
    alertSender = (alert) => legacy.send(alert);
  }
  return alertSender;
}

/**
 * Record a personalization degradation. Fire-and-forget: this function
 * never throws and never blocks the caller — a paging outage must not
 * take the baseline/lesson path down with it.
 */
export function emitDegradation(event: DegradationEvent, detail: DegradationDetail = {}): void {
  const reason = detail.reason ?? "unspecified";
  // 401/403 from an internal service means credentials/config, not load —
  // that is the exact silent-misconfig class this module exists to catch.
  const severity: "warning" | "critical" =
    detail.status === 401 || detail.status === 403 ? "critical" : BASE_SEVERITY[event];

  try {
    counter.increment(1, { event, reason });
  } catch {
    // Counters are best-effort.
  }

  logger.warn(
    { event: `degradation.${event}`, severity, ...detail },
    `[degradation] ${event} (${reason})`,
  );

  const sender = getAlertSender();
  if (!sender) return;

  const hint =
    detail.status === 401 || detail.status === 403
      ? " Likely cause: missing/invalid ASSESSMENT_SVC_SERVICE_TOKEN or INTERNAL_SERVICE_TOKEN."
      : "";
  void sender({
    severity,
    title: `web-v2 degradation: ${event}`,
    body:
      `${detail.message ?? reason}${hint}` +
      (detail.status ? ` (upstream status ${detail.status})` : ""),
    dedupKey: `${event}:${reason}`,
    fields: {
      reason,
      status: detail.status ?? null,
      provider: detail.provider ?? null,
      tenantId: detail.tenantId ?? null,
    },
  }).catch((err) => {
    logger.warn(
      { event: "degradation.alert_send_failed", err: err instanceof Error ? err.message : String(err) },
      "[degradation] ops alert send failed (telemetry only — caller unaffected)",
    );
  });
}

/** Test seam: inject a fake sender (bypasses the prod-runtime gate). */
export function __setDegradationAlertSenderForTests(sender: AlertSender | null): void {
  testSender = sender;
}

/** Test seam: drop the lazily-built production client. */
export function __resetDegradationForTests(): void {
  alertSender = null;
  testSender = null;
}
