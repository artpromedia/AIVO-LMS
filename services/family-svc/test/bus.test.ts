/**
 * Sprint 5: the family-svc realtime bus round-trips in-process (the NATS
 * fallback used in single-process dev/CI/tests). No NATS server required.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { getRealtimeBus, _resetRealtimeBusForTest } from "../src/realtime/bus.js";

test("realtime bus publish/subscribe round-trips in-process", async () => {
  await _resetRealtimeBusForTest();
  const bus = await getRealtimeBus();
  assert.equal(bus.backend, "in-process");
  const received: unknown[] = [];
  const unsub = await bus.subscribe("caregiver.observation.created", (p) => received.push(p));
  await bus.publish("caregiver.observation.created", { learnerId: "l1", category: "sensory" });
  assert.deepEqual(received, [{ learnerId: "l1", category: "sensory" }]);
  await unsub();
});
