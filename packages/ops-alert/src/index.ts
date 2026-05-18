/**
 * @deprecated Sprint 7 — `@aivo/ops-alert`. (Task #69)
 *
 * As of v2.1 §9.1 dedup, this package is **deprecated**. New code should
 * use `@aivo/ops-alerts` (durable outbox + alerts-proxy-svc). Drop-in
 * callers that still need the `send({severity,title,body,dedupKey,fields})`
 * shape can wrap the new client with `LegacyOpsAlertClient`:
 *
 *   import { OpsAlertClient, LegacyOpsAlertClient } from "@aivo/ops-alerts";
 *   const legacy = new LegacyOpsAlertClient({ client });
 *   await legacy.send({ severity, title, body, dedupKey, fields });
 *
 * The implementation below is preserved verbatim so any not-yet-migrated
 * call sites keep working while the migration completes. Do not add new
 * features here.
 *
 * One client used by every service that pages on-call. Each service used to
 * read its own `_WATCHDOG_WEBHOOK_URL` env vars and shape its own JSON for
 * Slack/PagerDuty/Opsgenie. This module centralizes:
 *
 *   - Where alerts go: `OPS_ALERT_WEBHOOK_URL` (and optional auth header).
 *   - The provider format: Slack-incoming-webhook, PagerDuty-events-v2, or
 *     Opsgenie-team-API. Detected from `OPS_ALERT_PROVIDER` (default `slack`).
 *   - A small dedup window so the same alert key doesn't page twice within N
 *     seconds even if multiple watchdog ticks fire.
 *
 * Services should never POST directly to webhooks anymore — they should call
 * `getOpsAlertClient().send({ severity, title, body, dedupKey })`.
 */

export type AlertSeverity = "info" | "warning" | "critical";
export type AlertProvider = "slack" | "pagerduty" | "opsgenie" | "generic";

export interface OpsAlert {
  severity: AlertSeverity;
  title: string;
  body: string;
  /** Suppress duplicate alerts with the same key within `dedupWindowMs`. */
  dedupKey?: string;
  /** Free-form fields surfaced as JSON to the destination. */
  fields?: Record<string, string | number | boolean | null>;
}

export interface OpsAlertClientConfig {
  webhookUrl?: string;
  authHeader?: string;
  provider?: AlertProvider;
  dedupWindowMs?: number;
  /** Override the fetch implementation (for tests). */
  fetchImpl?: typeof fetch;
  /** Override the clock (for tests). */
  now?: () => number;
}

export interface OpsAlertClient {
  send(alert: OpsAlert): Promise<{ delivered: boolean; deduped: boolean; status?: number }>;
}

const DEFAULT_DEDUP_MS = 60 * 60 * 1000; // 1h

function shapePayload(alert: OpsAlert, provider: AlertProvider): unknown {
  switch (provider) {
    case "slack": {
      const emoji =
        alert.severity === "critical"
          ? ":rotating_light:"
          : alert.severity === "warning"
            ? ":warning:"
            : ":information_source:";
      const fieldLines = alert.fields
        ? Object.entries(alert.fields)
            .map(([k, v]) => `*${k}*: ${String(v)}`)
            .join("\n")
        : "";
      return {
        text: `${emoji} ${alert.title}`,
        blocks: [
          { type: "header", text: { type: "plain_text", text: alert.title } },
          { type: "section", text: { type: "mrkdwn", text: alert.body } },
          ...(fieldLines ? [{ type: "section", text: { type: "mrkdwn", text: fieldLines } }] : []),
        ],
      };
    }
    case "pagerduty": {
      return {
        routing_key: undefined, // Caller injects via env if using events-v2.
        event_action: "trigger",
        dedup_key: alert.dedupKey,
        payload: {
          summary: alert.title,
          severity:
            alert.severity === "critical"
              ? "critical"
              : alert.severity === "warning"
                ? "warning"
                : "info",
          source: "aivo",
          custom_details: { body: alert.body, ...alert.fields },
        },
      };
    }
    case "opsgenie": {
      return {
        message: alert.title,
        description: alert.body,
        priority: alert.severity === "critical" ? "P1" : alert.severity === "warning" ? "P3" : "P5",
        alias: alert.dedupKey,
        details: alert.fields,
      };
    }
    case "generic":
    default:
      return {
        severity: alert.severity,
        title: alert.title,
        body: alert.body,
        dedupKey: alert.dedupKey,
        fields: alert.fields,
        timestamp: new Date().toISOString(),
      };
  }
}

export function createOpsAlertClient(config: OpsAlertClientConfig = {}): OpsAlertClient {
  const url = config.webhookUrl ?? process.env.OPS_ALERT_WEBHOOK_URL;
  const auth = config.authHeader ?? process.env.OPS_ALERT_WEBHOOK_AUTH;
  const provider =
    config.provider ?? (process.env.OPS_ALERT_PROVIDER as AlertProvider | undefined) ?? "slack";
  const dedupWindowMs = config.dedupWindowMs ?? DEFAULT_DEDUP_MS;
  const now = config.now ?? (() => Date.now());
  const fetchImpl: typeof fetch = config.fetchImpl ?? (globalThis.fetch as typeof fetch);
  const recentlySent = new Map<string, number>();

  return {
    async send(alert) {
      if (alert.dedupKey) {
        const t = recentlySent.get(alert.dedupKey);
        if (t && now() - t < dedupWindowMs) {
          return { delivered: false, deduped: true };
        }
      }
      if (!url) {
        // No destination configured — record the dedup so logs aren't spammy.
        if (alert.dedupKey) recentlySent.set(alert.dedupKey, now());
        return { delivered: false, deduped: false };
      }
      const payload = shapePayload(alert, provider);
      const headers: Record<string, string> = { "content-type": "application/json" };
      if (auth) headers.authorization = auth;
      const res = await fetchImpl(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      if (alert.dedupKey) recentlySent.set(alert.dedupKey, now());
      return { delivered: res.ok, deduped: false, status: res.status };
    },
  };
}

let singleton: OpsAlertClient | null = null;

/**
 * Lazily-built process-wide client. Every service should reach for this
 * instead of building its own.
 */
export function getOpsAlertClient(): OpsAlertClient {
  if (!singleton) singleton = createOpsAlertClient();
  return singleton;
}

/** Test-only hook for resetting the singleton between cases. */
export function _resetOpsAlertClient(): void {
  singleton = null;
}
