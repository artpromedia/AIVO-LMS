import { describe, it } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { registerAlertIntakeRoutes } from "./routes.js";
import { AlertDeduper } from "./slo/dedupe.js";

function criticalAlert(extra: Record<string, string> = {}) {
  return {
    status: "firing" as const,
    labels: { alertname: "ApiDown", severity: "critical", component: "comp-api", ...extra },
    annotations: { summary: "API gateway is down", description: "5xx > 50% for 2m" },
  };
}

describe("synthetic outage → alert → auto-incident", () => {
  it("opens a status-page incident for a critical firing alert", async () => {
    const calls: Array<{ url: string; body: any }> = [];
    const fetchImpl = (async (url: any, init: any) => {
      calls.push({ url: String(url), body: JSON.parse(init.body) });
      return new Response(JSON.stringify({ incident: { id: "inc-auto-1" } }), { status: 201 });
    }) as unknown as typeof fetch;

    const app = Fastify();
    registerAlertIntakeRoutes(app, { fetchImpl, statusPageUrl: "http://status.test" });

    const res = await app.inject({
      method: "POST",
      url: "/api/alerts/webhook",
      payload: { alerts: [criticalAlert()] },
    });

    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.routed, 1);
    assert.equal(body.decisions[0].autoIncident.created, true);
    assert.equal(body.decisions[0].autoIncident.incidentId, "inc-auto-1");

    // Verified it actually called status-page to create the incident.
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /\/api\/statuspage\/incidents$/);
    assert.equal(calls[0].body.impact, "critical");
    assert.deepEqual(calls[0].body.affectedComponentIds, ["comp-api"]);
    await app.close();
  });

  it("dedupes repeated firing alerts so only one incident is opened", async () => {
    let createCount = 0;
    const fetchImpl = (async () => {
      createCount += 1;
      return new Response(JSON.stringify({ incident: { id: `inc-${createCount}` } }), { status: 201 });
    }) as unknown as typeof fetch;

    const app = Fastify();
    registerAlertIntakeRoutes(app, {
      fetchImpl,
      statusPageUrl: "http://status.test",
      deduper: new AlertDeduper(60_000),
    });

    const fire = () =>
      app.inject({ method: "POST", url: "/api/alerts/webhook", payload: { alerts: [criticalAlert()] } });

    const first = (await fire()).json();
    const second = (await fire()).json();

    assert.equal(first.routed, 1);
    assert.equal(second.routed, 0);
    assert.equal(second.suppressed, 1);
    assert.equal(createCount, 1); // only one incident opened despite two webhooks
    await app.close();
  });

  it("does not open incidents for warning-level alerts", async () => {
    let createCount = 0;
    const fetchImpl = (async () => {
      createCount += 1;
      return new Response("{}", { status: 201 });
    }) as unknown as typeof fetch;
    const app = Fastify();
    registerAlertIntakeRoutes(app, { fetchImpl, statusPageUrl: "http://status.test" });

    const res = await app.inject({
      method: "POST",
      url: "/api/alerts/webhook",
      payload: { alerts: [criticalAlert({ severity: "warning" })] },
    });
    assert.equal(res.statusCode, 200);
    assert.equal(createCount, 0);
    await app.close();
  });
});
