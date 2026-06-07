import { describe, it, expect, beforeEach } from "vitest";
import { EVENTS, type CaregiverObservationCreatedPayload } from "@aivo/events";
import { createObservationConsumer } from "../services/observation-consumer.js";
import { getRealtimeBus, _resetRealtimeBusForTest } from "../realtime/bus.js";
import type { ProfileRecommendation } from "../services/types.js";

function obs(
  overrides: Partial<CaregiverObservationCreatedPayload>,
): CaregiverObservationCreatedPayload {
  return {
    observationId: Math.random().toString(36).slice(2),
    learnerId: "learner-1",
    contributorUserId: "user-1",
    contributorRole: "teacher",
    category: "sensory",
    notes: "Sensory overload.",
    mood: null,
    observedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("observation consumer", () => {
  beforeEach(async () => {
    await _resetRealtimeBusForTest();
  });

  it("emits a PENDING recommendation after two corroborating observations", async () => {
    const emitted: Array<{ learnerId: string; recs: ProfileRecommendation[] }> = [];
    const consumer = createObservationConsumer({
      onRecommendations: (learnerId, recs) => {
        emitted.push({ learnerId, recs });
      },
    });

    // First observation: not enough corroboration yet.
    await consumer.handle(obs({ contributorRole: "teacher" }));
    expect(emitted).toHaveLength(0);

    // Second observation of the same concern: fires.
    await consumer.handle(obs({ contributorRole: "caregiver" }));
    expect(emitted).toHaveLength(1);
    const rec = emitted[0].recs.find((r) => r.type === "sensory_setting_change")!;
    expect(rec).toBeDefined();
    expect(rec.status).toBe("PENDING");
    expect(rec.safety.requiresParentApproval).toBe(true);
    const roles = rec.evidence.map((e) => e.contributorRole);
    expect(roles).toContain("teacher");
    expect(roles).toContain("caregiver");
  });

  it("does not re-emit the same recommendation type for a learner", async () => {
    const emitted: ProfileRecommendation[] = [];
    const consumer = createObservationConsumer({
      onRecommendations: (_learnerId, recs) => {
        emitted.push(...recs);
      },
    });
    await consumer.handle(obs({}));
    await consumer.handle(obs({}));
    await consumer.handle(obs({})); // third — must not duplicate
    expect(emitted.filter((r) => r.type === "sensory_setting_change")).toHaveLength(1);
  });

  it("consumes events published on the realtime bus end-to-end", async () => {
    const emitted: ProfileRecommendation[] = [];
    const consumer = createObservationConsumer({
      onRecommendations: (_l, recs) => {
        emitted.push(...recs);
      },
    });
    const bus = await getRealtimeBus();
    expect(bus.backend).toBe("in-process"); // no NATS_URL in tests
    const unsub = await consumer.start(bus);

    await bus.publish(EVENTS.CAREGIVER_OBSERVATION_CREATED, obs({ contributorRole: "teacher" }));
    await bus.publish(EVENTS.CAREGIVER_OBSERVATION_CREATED, obs({ contributorRole: "therapist" }));
    // Allow the void-async handler microtasks to flush.
    await new Promise((r) => setTimeout(r, 10));

    expect(emitted.some((r) => r.type === "sensory_setting_change")).toBe(true);
    await unsub();
  });
});
