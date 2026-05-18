#!/usr/bin/env node
// External liveness check for alerts-proxy-svc (#173).
//
// MUST run out-of-band from the proxy itself — typically as a Kubernetes
// CronJob in a separate namespace, an external uptime monitor, or a sidecar
// on a different host. If the proxy returns non-200 or fails to respond,
// pages PagerDuty AND/OR Opsgenie DIRECTLY (not through the proxy).
//
// Required env (at least one of PagerDuty/Opsgenie):
//   ALERTS_PROXY_HEALTH_URL          full URL to /api/alerts/health
//   PAGERDUTY_DIRECT_ROUTING_KEY     events v2 routing key (out-of-band)
//   OPSGENIE_DIRECT_API_KEY          opsgenie API key (out-of-band)
//   ALERT_PROXY_DEDUP_KEY            optional dedup key (default: alerts-proxy-down)
//   PROBE_TIMEOUT_MS                 fetch timeout (default 5000)

import { request as httpsRequest } from "node:https";
import { request as httpRequest } from "node:http";
import { URL } from "node:url";

const HEALTH_URL = process.env.ALERTS_PROXY_HEALTH_URL;
const PD_KEY = process.env.PAGERDUTY_DIRECT_ROUTING_KEY;
const OG_KEY = process.env.OPSGENIE_DIRECT_API_KEY;
const DEDUP = process.env.ALERT_PROXY_DEDUP_KEY || "alerts-proxy-down";
const TIMEOUT = parseInt(process.env.PROBE_TIMEOUT_MS || "5000", 10);

if (!HEALTH_URL) {
  console.error("ALERTS_PROXY_HEALTH_URL is required");
  process.exit(2);
}
if (!PD_KEY && !OG_KEY) {
  console.error(
    "At least one of PAGERDUTY_DIRECT_ROUTING_KEY or OPSGENIE_DIRECT_API_KEY must be set " +
      "— this monitor MUST page out-of-band, not through the proxy",
  );
  process.exit(2);
}

async function probe() {
  try {
    const res = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(TIMEOUT) });
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
    const body = await res.json().catch(() => ({}));
    if (body.status !== "ok") return { ok: false, reason: `body.status=${body.status}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err?.message ?? String(err) };
  }
}

async function postJson(urlStr, headers, payload) {
  const url = new URL(urlStr);
  const lib = url.protocol === "https:" ? httpsRequest : httpRequest;
  const data = JSON.stringify(payload);
  return new Promise((resolve, reject) => {
    const req = lib(
      {
        method: "POST",
        hostname: url.hostname,
        port: url.port || (url.protocol === "https:" ? 443 : 80),
        path: url.pathname + url.search,
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(data),
          ...headers,
        },
        timeout: TIMEOUT,
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () =>
          resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString("utf8") }),
        );
      },
    );
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.write(data);
    req.end();
  });
}

async function pagePagerDuty(reason) {
  if (!PD_KEY) return;
  const res = await postJson(
    "https://events.pagerduty.com/v2/enqueue",
    {},
    {
      routing_key: PD_KEY,
      event_action: "trigger",
      dedup_key: DEDUP,
      payload: {
        summary: `alerts-proxy-svc liveness check failed: ${reason}`,
        severity: "critical",
        source: "ops-alerts-external-monitor",
        component: "alerts-proxy-svc",
        group: "platform-ops",
        class: "outage",
        custom_details: { health_url: HEALTH_URL, reason },
      },
    },
  );
  console.log(`pagerduty: status=${res.status}`);
}

async function pageOpsgenie(reason) {
  if (!OG_KEY) return;
  const res = await postJson(
    "https://api.opsgenie.com/v2/alerts",
    { authorization: `GenieKey ${OG_KEY}` },
    {
      message: `alerts-proxy-svc liveness check failed`,
      alias: DEDUP,
      description: `Liveness probe of ${HEALTH_URL} failed: ${reason}`,
      priority: "P1",
      source: "ops-alerts-external-monitor",
    },
  );
  console.log(`opsgenie: status=${res.status}`);
}

async function resolvePagerDuty() {
  if (!PD_KEY) return;
  await postJson(
    "https://events.pagerduty.com/v2/enqueue",
    {},
    {
      routing_key: PD_KEY,
      event_action: "resolve",
      dedup_key: DEDUP,
    },
  );
}

async function main() {
  const result = await probe();
  if (result.ok) {
    console.log("alerts-proxy healthy");
    await resolvePagerDuty().catch((e) => console.error("resolve failed:", e?.message));
    return;
  }
  console.error(`alerts-proxy DOWN: ${result.reason} — paging out-of-band`);
  await Promise.allSettled([pagePagerDuty(result.reason), pageOpsgenie(result.reason)]);
  process.exit(1);
}

main().catch((err) => {
  console.error("monitor crashed:", err);
  process.exit(1);
});
