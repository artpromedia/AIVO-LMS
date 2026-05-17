import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { OpsAlertClient } from "./client.js";
import { MemoryOpsAlertOutboxStore } from "./stores/memory.js";
import type { OpsAlertEnvelope, OpsAlertOutboxStore } from "./types.js";

class ExplodingStore implements OpsAlertOutboxStore {
  readonly kind = "memory" as const;
  drainCalls = 0;
  enqueueCalls = 0;
  async enqueue(_e: OpsAlertEnvelope): Promise<void> {
    this.enqueueCalls++;
  }
  async drain(): Promise<{ drained: number; remaining: number }> {
    this.drainCalls++;
    throw new Error("simulated store failure");
  }
  async size(): Promise<number> {
    return 1;
  }
}

describe("OpsAlertClient auto-flush defensive paths (#210)", () => {
  it("a throwing store does not crash the client; the tick counter still increments next interval", async () => {
    const store = new ExplodingStore();
    const ticks: Array<{ drained: number; error: Error | null }> = [];
    const client = new OpsAlertClient({
      service: "test-svc",
      proxyUrl: "http://localhost:9999",
      outbox: store,
      autoFlushIntervalMs: 0,
      onAutoFlush: (info) => {
        ticks.push(info);
      },
    });

    await client.triggerAutoFlushTickForTest();
    await client.triggerAutoFlushTickForTest();

    assert.equal(store.drainCalls, 2, "drain should have been called both times");
    assert.equal(ticks.length, 2, "onAutoFlush should fire on both ticks");
    for (const t of ticks) {
      assert.ok(t.error, "tick should report the store error");
      assert.equal(t.drained, 0);
    }

    const stats = await client.stats_();
    assert.equal(stats.autoFlushTicksTotal, 2);
    assert.equal(stats.autoFlushErrorsTotal, 2);
    assert.equal(stats.autoFlushDrainedTotal, 0);
  });

  it("normal happy path increments ticks and drained counters", async () => {
    const store = new MemoryOpsAlertOutboxStore();
    const fetchImpl = (async () => new Response("", { status: 200 })) as unknown as typeof fetch;
    const client = new OpsAlertClient({
      service: "test-svc",
      proxyUrl: "http://localhost:9999",
      outbox: store,
      autoFlushIntervalMs: 0,
      fetchImpl,
    });
    // Force one envelope into the outbox by failing delivery first.
    const failingFetch = (async () => new Response("", { status: 503 })) as unknown as typeof fetch;
    (client as any).opts.fetchImpl = failingFetch;
    await client.page({ severity: "info", title: "x", message: "y" });
    (client as any).opts.fetchImpl = fetchImpl;

    await client.triggerAutoFlushTickForTest();

    const stats = await client.stats_();
    assert.equal(stats.autoFlushTicksTotal, 1);
    assert.equal(stats.autoFlushErrorsTotal, 0);
    assert.equal(stats.autoFlushDrainedTotal, 1);
  });
});
