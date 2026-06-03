/**
 * Phase 5 (realtime): mirror of comms-svc bus test. The parent co-view
 * subject is keyed by learnerId, and a fan-out failure here means
 * parents fall back silently to polling — so the contract is worth
 * pinning down explicitly per service.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  getRealtimeBus,
  subjects,
  _resetRealtimeBusForTest,
} from "../src/realtime/bus.js";

describe("learning-svc realtime bus (in-process)", () => {
  before(async () => {
    delete process.env.NATS_URL;
    await _resetRealtimeBusForTest();
  });

  after(async () => {
    await _resetRealtimeBusForTest();
  });

  it("delivers session.coview payloads keyed by learnerId", async () => {
    const publisher = await getRealtimeBus();
    const subscriber = await getRealtimeBus();
    assert.equal(publisher.backend, "in-process");

    const seen: unknown[] = [];
    const off = await subscriber.subscribe(
      subjects.sessionCoview("learner-1"),
      (p) => seen.push(p),
    );

    await publisher.publish(subjects.sessionCoview("learner-1"), {
      type: "session.created",
      sessionId: "s1",
    });
    await publisher.publish(subjects.sessionCoview("learner-2"), {
      type: "session.created",
      sessionId: "s2",
    });
    await new Promise((r) => setImmediate(r));

    assert.deepEqual(seen, [{ type: "session.created", sessionId: "s1" }]);
    await off();
  });
});
