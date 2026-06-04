/**
 * Phase 5 (realtime): the in-process bus is the contract two callers in
 * the same Node process see when NATS isn't configured. We don't ship a
 * NATS server in tests, so this asserts the EventEmitter-singleton path:
 * two `getRealtimeBus()` consumers share the same subject space, fan-out
 * actually fans out, and unsubscribing actually stops delivery.
 *
 * This is the load-bearing test for the polling-fallback story: if the
 * bus delivers, the SSE route delivers; if not, the documented polling
 * fallback is doing all the work.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { getRealtimeBus, subjects, _resetRealtimeBusForTest } from "../src/realtime/bus.js";

describe("realtime bus (in-process)", () => {
  before(async () => {
    delete process.env.NATS_URL;
    await _resetRealtimeBusForTest();
  });

  after(async () => {
    await _resetRealtimeBusForTest();
  });

  it("fans out a published payload to a subscriber on the same subject", async () => {
    const publisher = await getRealtimeBus();
    const subscriber = await getRealtimeBus();
    assert.equal(publisher.backend, "in-process");

    const subject = subjects.inboxThread("t-fan-out-1");
    const received: unknown[] = [];
    const off = await subscriber.subscribe(subject, (payload) => {
      received.push(payload);
    });

    await publisher.publish(subject, { type: "message.created", id: "m1" });
    await publisher.publish(subject, { type: "message.created", id: "m2" });

    // Emitter is synchronous, but yield once so any microtask listeners drain.
    await new Promise((r) => setImmediate(r));

    assert.deepEqual(received, [
      { type: "message.created", id: "m1" },
      { type: "message.created", id: "m2" },
    ]);

    await off();
    await publisher.publish(subject, { type: "message.created", id: "m3" });
    await new Promise((r) => setImmediate(r));
    assert.equal(received.length, 2, "unsubscribed handler must not fire");
  });

  it("isolates subjects from one another", async () => {
    const bus = await getRealtimeBus();
    const a: unknown[] = [];
    const b: unknown[] = [];
    const offA = await bus.subscribe(subjects.inboxThread("ta"), (p) => a.push(p));
    const offB = await bus.subscribe(subjects.inboxThread("tb"), (p) => b.push(p));

    await bus.publish(subjects.inboxThread("ta"), { who: "a" });
    await bus.publish(subjects.inboxThread("tb"), { who: "b" });
    await new Promise((r) => setImmediate(r));

    assert.deepEqual(a, [{ who: "a" }]);
    assert.deepEqual(b, [{ who: "b" }]);

    await offA();
    await offB();
  });
});
