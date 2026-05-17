/**
 * Sprint 7 — `@aivo/ops-alert` unit tests.
 */
import { test } from "node:test";
import assert from "node:assert";
import { createOpsAlertClient } from "../src/index.js";

function makeFakeFetch() {
  const calls: Array<{ url: string; body: any; headers: Record<string, string> }> = [];
  const fakeFetch: typeof fetch = async (url, init) => {
    calls.push({
      url: String(url),
      body: init?.body ? JSON.parse(String(init.body)) : null,
      headers: (init?.headers as Record<string, string>) ?? {},
    });
    return {
      ok: true,
      status: 204,
      json: async () => ({}),
    } as unknown as Response;
  };
  return { calls, fetch: fakeFetch };
}

test("returns delivered:false when no webhook URL is configured", async () => {
  const { fetch } = makeFakeFetch();
  const client = createOpsAlertClient({ fetchImpl: fetch });
  const r = await client.send({ severity: "critical", title: "x", body: "y" });
  assert.equal(r.delivered, false);
});

test("posts a Slack-shaped payload by default", async () => {
  const { calls, fetch } = makeFakeFetch();
  const client = createOpsAlertClient({
    fetchImpl: fetch,
    webhookUrl: "https://example/slack",
  });
  await client.send({ severity: "warning", title: "Job stale", body: "Body text" });
  assert.equal(calls.length, 1);
  assert.match(calls[0].body.text, /Job stale/);
  assert.ok(Array.isArray(calls[0].body.blocks));
});

test("posts a PagerDuty-shaped payload when configured", async () => {
  const { calls, fetch } = makeFakeFetch();
  const client = createOpsAlertClient({
    fetchImpl: fetch,
    webhookUrl: "https://example/pd",
    provider: "pagerduty",
  });
  await client.send({
    severity: "critical",
    title: "Stale",
    body: "Body",
    dedupKey: "job:x",
  });
  assert.equal(calls[0].body.event_action, "trigger");
  assert.equal(calls[0].body.dedup_key, "job:x");
  assert.equal(calls[0].body.payload.severity, "critical");
});

test("dedups identical alerts within the dedup window", async () => {
  const { calls, fetch } = makeFakeFetch();
  let now = 1_000_000;
  const client = createOpsAlertClient({
    fetchImpl: fetch,
    webhookUrl: "https://example",
    dedupWindowMs: 1000,
    now: () => now,
  });
  const r1 = await client.send({ severity: "critical", title: "t", body: "b", dedupKey: "k" });
  const r2 = await client.send({ severity: "critical", title: "t", body: "b", dedupKey: "k" });
  assert.equal(r1.delivered, true);
  assert.equal(r2.deduped, true);
  assert.equal(calls.length, 1);
  // After the window, sends through again.
  now += 2000;
  const r3 = await client.send({ severity: "critical", title: "t", body: "b", dedupKey: "k" });
  assert.equal(r3.delivered, true);
  assert.equal(calls.length, 2);
});

test("attaches authorization header when configured", async () => {
  const { calls, fetch } = makeFakeFetch();
  const client = createOpsAlertClient({
    fetchImpl: fetch,
    webhookUrl: "https://example",
    authHeader: "Bearer secret",
  });
  await client.send({ severity: "info", title: "t", body: "b" });
  assert.equal(calls[0].headers.authorization, "Bearer secret");
});
