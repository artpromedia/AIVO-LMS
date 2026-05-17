import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { LegacyOpsAlertClient } from "./legacy.js";
import { OpsAlertClient } from "./client.js";
import { MemoryOpsAlertOutboxStore } from "./stores/memory.js";

interface FetchCall {
  url: string;
  body: any;
}

function makeClient(): { client: OpsAlertClient; calls: FetchCall[] } {
  const calls: FetchCall[] = [];
  const fetchImpl = async (url: any, init?: any): Promise<any> => {
    calls.push({ url: String(url), body: JSON.parse(init?.body ?? "{}") });
    return { ok: true, status: 200, text: async () => "" } as any;
  };
  const client = new OpsAlertClient({
    service: "test-svc",
    proxyUrl: "http://proxy.example",
    outbox: new MemoryOpsAlertOutboxStore({ maxDepth: 16 }),
    fetchImpl: fetchImpl as any,
    autoFlushIntervalMs: 0,
  });
  return { client, calls };
}

describe("LegacyOpsAlertClient", () => {
  it("translates legacy {body, fields} into the new {message, context} shape", async () => {
    const { client, calls } = makeClient();
    const legacy = new LegacyOpsAlertClient({ client });
    const result = await legacy.send({
      severity: "critical",
      title: "Background job stale: ledger-rollup",
      body: "Job ledger-rollup hasn't reported a finish in ~26h",
      dedupKey: "job-stale:ledger-rollup",
      fields: { service: "billing-svc", ageHours: 26, lastStatus: "failed" },
    });

    assert.equal(result.delivered, true);
    assert.equal(result.deduped, false);
    assert.equal(calls.length, 1);
    const env = calls[0].body;
    assert.equal(env.severity, "critical");
    assert.equal(env.title, "Background job stale: ledger-rollup");
    assert.equal(env.message, "Job ledger-rollup hasn't reported a finish in ~26h");
    assert.equal(env.service, "test-svc");
    assert.deepEqual(env.context.fields, {
      service: "billing-svc",
      ageHours: 26,
      lastStatus: "failed",
    });
    assert.equal(env.context.dedupKey, "job-stale:ledger-rollup");
  });

  it("dedups within the configured window and lets the call through after it", async () => {
    const { client, calls } = makeClient();
    let now = 1_000_000;
    const legacy = new LegacyOpsAlertClient({
      client,
      dedupWindowMs: 5_000,
      now: () => now,
    });

    const a = await legacy.send({ severity: "warning", title: "t", body: "b", dedupKey: "k" });
    assert.equal(a.delivered, true);
    assert.equal(a.deduped, false);

    now += 1_000;
    const b = await legacy.send({ severity: "warning", title: "t", body: "b", dedupKey: "k" });
    assert.equal(b.delivered, false);
    assert.equal(b.deduped, true);
    assert.equal(calls.length, 1, "second send within window must not call fetch");

    now += 6_000; // past the dedup window
    const c = await legacy.send({ severity: "warning", title: "t", body: "b", dedupKey: "k" });
    assert.equal(c.delivered, true);
    assert.equal(c.deduped, false);
    assert.equal(calls.length, 2);
  });

  it("alerts without a dedupKey are never deduped", async () => {
    const { client, calls } = makeClient();
    const legacy = new LegacyOpsAlertClient({ client });
    await legacy.send({ severity: "info", title: "t", body: "b" });
    await legacy.send({ severity: "info", title: "t", body: "b" });
    assert.equal(calls.length, 2);
  });

  it("omits context entirely when there are no fields and no dedupKey", async () => {
    const { client, calls } = makeClient();
    const legacy = new LegacyOpsAlertClient({ client });
    await legacy.send({ severity: "info", title: "t", body: "b" });
    assert.equal(calls[0].body.context, undefined);
  });

  it("propagates queued=true when the underlying client could not deliver", async () => {
    const calls: FetchCall[] = [];
    const fetchImpl = async (url: any, init?: any): Promise<any> => {
      calls.push({ url: String(url), body: JSON.parse(init?.body ?? "{}") });
      // Simulate proxy outage.
      return { ok: false, status: 503, text: async () => "" } as any;
    };
    const client = new OpsAlertClient({
      service: "test-svc",
      proxyUrl: "http://proxy.example",
      outbox: new MemoryOpsAlertOutboxStore({ maxDepth: 16 }),
      fetchImpl: fetchImpl as any,
      autoFlushIntervalMs: 0,
    });
    const legacy = new LegacyOpsAlertClient({ client });
    const result = await legacy.send({
      severity: "warning",
      title: "t",
      body: "b",
      dedupKey: "k1",
    });
    assert.equal(result.delivered, false);
    assert.equal(result.queued, true);
    assert.equal(result.deduped, false);
  });
});
