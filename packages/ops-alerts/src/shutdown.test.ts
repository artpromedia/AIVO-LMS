import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { OpsAlertClient } from "./client.js";
import { MemoryOpsAlertOutboxStore } from "./stores/memory.js";
import { installOpsAlertShutdown } from "./shutdown.js";
import type { ShutdownDrainOutcome } from "./types.js";

function makeClient(opts: { fetchImpl?: typeof fetch } = {}) {
  return new OpsAlertClient({
    service: "test-svc",
    proxyUrl: "http://localhost:9999",
    outbox: new MemoryOpsAlertOutboxStore(),
    fetchImpl: opts.fetchImpl ?? (async () => new Response("", { status: 503 })),
    autoFlushIntervalMs: 0,
  });
}

describe("installOpsAlertShutdown", () => {
  it("drains the outbox on SIGTERM and forwards the outcome to onDrain (#195)", async () => {
    const client = makeClient({
      fetchImpl: async () => new Response("", { status: 200 }),
    });
    await client.page({ severity: "critical", title: "t1", message: "m" });
    await client.page({ severity: "critical", title: "t2", message: "m" });

    let outcome: ShutdownDrainOutcome | null = null;
    const detach = installOpsAlertShutdown({
      client,
      windowMs: 200,
      onDrain: (o) => {
        outcome = o;
      },
      exitOnComplete: false,
    });

    process.emit("SIGTERM" as NodeJS.Signals);

    // Wait for the async drain to settle.
    await new Promise((r) => setTimeout(r, 100));
    detach();

    assert.ok(outcome, "onDrain was not called");
    const o = outcome as unknown as ShutdownDrainOutcome;
    assert.equal(o.service, "test-svc");
    assert.equal(o.lost, 0);
    assert.equal(o.flushTimedOut, false);
  });

  it("persists undelivered envelopes to a durable store before exit (#196)", async () => {
    const client = makeClient(); // proxy returns 503 — nothing will deliver
    await client.page({ severity: "critical", title: "t1", message: "m" });
    await client.page({ severity: "critical", title: "t2", message: "m" });

    const durable = new MemoryOpsAlertOutboxStore();
    const detach = installOpsAlertShutdown({
      client,
      windowMs: 100,
      durableStore: durable,
      exitOnComplete: false,
    });

    process.emit("SIGTERM" as NodeJS.Signals);
    await new Promise((r) => setTimeout(r, 200));
    detach();

    const stats = await client.stats_();
    assert.equal(await durable.size(), 2, "envelopes should have been persisted to durable store");
    assert.equal(stats.lastShutdown?.persisted, 2);
    assert.equal(stats.lastShutdown?.lost, 0);
  });
});
