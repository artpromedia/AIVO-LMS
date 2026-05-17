/**
 * Per-channel forwarders for the alerts-proxy. (#81)
 *
 * Every producer service POSTs an `OpsAlertEnvelope` to this service. Each
 * configured channel is asked to fan-out the same envelope into its native
 * shape:
 *
 *   - Slack: incoming webhook block-kit message
 *   - PagerDuty: events-v2 trigger
 *   - Opsgenie: team-API alert
 *
 * Forwarders are deliberately conservative: per-attempt timeouts, no retry
 * loops (the producer's outbox handles that), and each failure is reported
 * back to the proxy so it can return a per-channel breakdown.
 */
import type { ChannelConfig, ChannelId } from "./channels.js";

const PAGERDUTY_URL = "https://events.pagerduty.com/v2/enqueue"; // paging-url-leaks: ignore
const OPSGENIE_URL = "https://api.opsgenie.com/v2/alerts"; // paging-url-leaks: ignore

export interface OpsAlertEnvelope {
  id: string;
  service: string;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  context?: Record<string, unknown>;
  occurredAt?: string;
  attempt?: number;
}

export interface ForwardResult {
  channel: ChannelId;
  delivered: boolean;
  status?: number;
  error?: string;
  /** True if the channel was configured but skipped (e.g. severity filter). */
  skipped?: boolean;
}

export interface ForwarderDeps {
  fetchImpl?: typeof fetch;
  /** Per-attempt timeout in ms. Default 5000. */
  timeoutMs?: number;
  /** Opsgenie endpoint override (EU customers point at api.eu.opsgenie.com). */
  opsgenieUrl?: string;
}

export type Forwarder = (envelope: OpsAlertEnvelope, secret: string, deps: ForwarderDeps) => Promise<ForwardResult>;

function severityIcon(sev: OpsAlertEnvelope["severity"]): string {
  return sev === "critical" ? ":rotating_light:" : sev === "warning" ? ":warning:" : ":information_source:";
}

function pdSeverity(sev: OpsAlertEnvelope["severity"]): "critical" | "warning" | "info" {
  return sev === "critical" ? "critical" : sev === "warning" ? "warning" : "info";
}

function ogPriority(sev: OpsAlertEnvelope["severity"]): "P1" | "P3" | "P5" {
  return sev === "critical" ? "P1" : sev === "warning" ? "P3" : "P5";
}

function withTimeout(ms: number): AbortSignal {
  return AbortSignal.timeout(ms);
}

export const slackForwarder: Forwarder = async (env, secret, deps) => {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const timeout = deps.timeoutMs ?? 5_000;
  const fields = env.context
    ? Object.entries(env.context)
        .filter(([, v]) => typeof v !== "object" || v === null)
        .map(([k, v]) => `*${k}*: ${String(v)}`)
        .join("\n")
    : "";
  const headerText = `${severityIcon(env.severity)} ${env.title}`;
  const body = {
    text: headerText,
    blocks: [
      { type: "header", text: { type: "plain_text", text: env.title.slice(0, 150) } },
      {
        type: "section",
        text: { type: "mrkdwn", text: `*service:* ${env.service}  *severity:* ${env.severity}` },
      },
      { type: "section", text: { type: "mrkdwn", text: env.message.slice(0, 2900) } },
      ...(fields ? [{ type: "section", text: { type: "mrkdwn", text: fields.slice(0, 2900) } }] : []),
    ],
  };
  try {
    const res = await fetchImpl(secret, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: withTimeout(timeout),
    });
    return { channel: "slack", delivered: res.ok, status: res.status };
  } catch (err: any) {
    return { channel: "slack", delivered: false, error: err?.message ?? "unknown" };
  }
};

export const pagerDutyForwarder: Forwarder = async (env, secret, deps) => {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const timeout = deps.timeoutMs ?? 5_000;
  // PagerDuty only escalates on warning+, info events would just spam responders.
  if (env.severity === "info") return { channel: "pagerduty", delivered: false, skipped: true };
  const body = {
    routing_key: secret,
    event_action: "trigger",
    dedup_key: `${env.service}:${env.title}`.slice(0, 250),
    payload: {
      summary: `${env.service}: ${env.title}`.slice(0, 1024),
      severity: pdSeverity(env.severity),
      source: env.service,
      custom_details: {
        message: env.message.slice(0, 4000),
        ...(env.context ?? {}),
      },
    },
  };
  try {
    const res = await fetchImpl(PAGERDUTY_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: withTimeout(timeout),
    });
    return { channel: "pagerduty", delivered: res.ok, status: res.status };
  } catch (err: any) {
    return { channel: "pagerduty", delivered: false, error: err?.message ?? "unknown" };
  }
};

export const opsgenieForwarder: Forwarder = async (env, secret, deps) => {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const timeout = deps.timeoutMs ?? 5_000;
  if (env.severity === "info") return { channel: "opsgenie", delivered: false, skipped: true };
  const url = deps.opsgenieUrl ?? OPSGENIE_URL;
  const body = {
    message: `${env.service}: ${env.title}`.slice(0, 130),
    description: env.message.slice(0, 15000),
    priority: ogPriority(env.severity),
    alias: `${env.service}:${env.title}`.slice(0, 250),
    source: env.service,
    details: env.context ?? {},
  };
  try {
    const res = await fetchImpl(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `GenieKey ${secret}`,
      },
      body: JSON.stringify(body),
      signal: withTimeout(timeout),
    });
    return { channel: "opsgenie", delivered: res.ok, status: res.status };
  } catch (err: any) {
    return { channel: "opsgenie", delivered: false, error: err?.message ?? "unknown" };
  }
};

export const FORWARDERS: Record<ChannelId, Forwarder> = {
  slack: slackForwarder,
  pagerduty: pagerDutyForwarder,
  opsgenie: opsgenieForwarder,
};

export async function fanOut(
  envelope: OpsAlertEnvelope,
  channels: ChannelConfig[],
  deps: ForwarderDeps = {},
): Promise<ForwardResult[]> {
  const enabled = channels.filter((c) => c.configured && c.secret);
  return await Promise.all(
    enabled.map((c) => FORWARDERS[c.id](envelope, c.secret as string, deps)),
  );
}
