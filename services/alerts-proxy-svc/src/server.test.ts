import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildServer } from "./index.js";
import { loadChannels } from "./channels.js";

describe("alerts-proxy-svc /api/alerts/health", () => {
  it("reports productionReady=true when all required channels are configured", async () => {
    const channels = loadChannels({
      OPS_ALERTS_SLACK_WEBHOOK_URL: "https://hooks.slack.example/x",
      OPS_ALERTS_PAGERDUTY_ROUTING_KEY: "pd-key",
      OPS_ALERTS_OPSGENIE_API_KEY: "og-key",
    });
    const app = await buildServer({ channels });
    const res = await app.inject({ method: "GET", url: "/api/alerts/health" });
    assert.equal(res.statusCode, 200);
    const body = res.json() as any;
    assert.deepEqual(body.channels.sort(), ["opsgenie", "pagerduty", "slack"]);
    assert.equal(body.productionReady, true);
    assert.deepEqual(body.missingRequired, []);
    // health response must not leak secrets
    const stringified = JSON.stringify(body);
    assert.equal(stringified.includes("pd-key"), false);
    assert.equal(stringified.includes("og-key"), false);
    assert.equal(stringified.includes("hooks.slack.example"), false);
    await app.close();
  });

  it("reports missingRequired when channels are absent", async () => {
    const channels = loadChannels({});
    const app = await buildServer({ channels });
    const res = await app.inject({ method: "GET", url: "/api/alerts/health" });
    const body = res.json() as any;
    assert.equal(body.productionReady, false);
    assert.deepEqual(body.missingRequired.sort(), ["opsgenie", "pagerduty", "slack"]);
    await app.close();
  });
});

describe("alerts-proxy-svc /api/alerts/page", () => {
  it("fans out a critical envelope to every configured channel in native shape", async () => {
    const calls: Array<{ url: string; body: unknown; headers: Record<string, string> }> = [];
    const fakeFetch: typeof fetch = (async (url: any, init: any) => {
      calls.push({
        url: String(url),
        body: JSON.parse(init.body),
        headers: init.headers ?? {},
      });
      return { ok: true, status: 200 } as any;
    }) as any;
    const channels = loadChannels({
      OPS_ALERTS_SLACK_WEBHOOK_URL: "https://hooks.slack.example/x",
      OPS_ALERTS_PAGERDUTY_ROUTING_KEY: "pd-routing-key",
      OPS_ALERTS_OPSGENIE_API_KEY: "og-key",
    });
    const app = await buildServer({ channels, forwarderDeps: { fetchImpl: fakeFetch } });
    const res = await app.inject({
      method: "POST",
      url: "/api/alerts/page",
      payload: {
        id: "envelope-1",
        service: "billing-svc",
        severity: "critical",
        title: "billing.daily-expiry-reminders is stale",
        message: "Last finish was 36h ago.",
        context: { ageHours: 36 },
      },
    });
    assert.equal(res.statusCode, 200);
    const body = res.json() as any;
    assert.deepEqual(body.delivered.sort(), ["opsgenie", "pagerduty", "slack"]);

    const slackCall = calls.find((c) => c.url.includes("hooks.slack.example"))!;
    const slackBody = slackCall.body as any;
    assert.ok(slackBody.text.includes("billing.daily-expiry-reminders"));
    assert.ok(Array.isArray(slackBody.blocks) && slackBody.blocks.length >= 2);

    const pdCall = calls.find((c) => c.url.includes("events.pagerduty.com"))!;
    const pdBody = pdCall.body as any;
    assert.equal(pdBody.routing_key, "pd-routing-key");
    assert.equal(pdBody.event_action, "trigger");
    assert.equal(pdBody.payload.severity, "critical");
    assert.equal(pdBody.payload.source, "billing-svc");

    const ogCall = calls.find((c) => c.url.includes("opsgenie.com"))!;
    assert.equal(ogCall.headers.authorization, "GenieKey og-key");
    const ogBody = ogCall.body as any;
    assert.equal(ogBody.priority, "P1");
    assert.ok(ogBody.message.includes("billing-svc"));
    await app.close();
  });

  it("skips PagerDuty/Opsgenie for severity=info but still hits Slack", async () => {
    const calls: string[] = [];
    const fakeFetch: typeof fetch = (async (url: any) => {
      calls.push(String(url));
      return { ok: true, status: 200 } as any;
    }) as any;
    const channels = loadChannels({
      OPS_ALERTS_SLACK_WEBHOOK_URL: "https://hooks.slack.example/x",
      OPS_ALERTS_PAGERDUTY_ROUTING_KEY: "pd",
      OPS_ALERTS_OPSGENIE_API_KEY: "og",
    });
    const app = await buildServer({ channels, forwarderDeps: { fetchImpl: fakeFetch } });
    const res = await app.inject({
      method: "POST",
      url: "/api/alerts/page",
      payload: { service: "comms-svc", severity: "info", title: "hello", message: "world" },
    });
    const body = res.json() as any;
    assert.deepEqual(body.delivered, ["slack"]);
    assert.equal(calls.length, 1);
    assert.ok(calls[0].includes("hooks.slack.example"));
    await app.close();
  });

  it("returns 502 when every configured channel fails", async () => {
    const fakeFetch: typeof fetch = (async () => {
      return { ok: false, status: 500 } as any;
    }) as any;
    const channels = loadChannels({
      OPS_ALERTS_SLACK_WEBHOOK_URL: "https://hooks.slack.example/x",
      OPS_ALERTS_PAGERDUTY_ROUTING_KEY: "pd",
      OPS_ALERTS_OPSGENIE_API_KEY: "og",
    });
    const app = await buildServer({ channels, forwarderDeps: { fetchImpl: fakeFetch } });
    const res = await app.inject({
      method: "POST",
      url: "/api/alerts/page",
      payload: { service: "x", severity: "critical", title: "t", message: "m" },
    });
    assert.equal(res.statusCode, 502);
    await app.close();
  });

  it("rejects malformed envelopes", async () => {
    const channels = loadChannels({ OPS_ALERTS_SLACK_WEBHOOK_URL: "https://hooks.slack.example/x" });
    const app = await buildServer({ channels });
    const res = await app.inject({ method: "POST", url: "/api/alerts/page", payload: { service: 1 } });
    assert.equal(res.statusCode, 400);
    await app.close();
  });
});
