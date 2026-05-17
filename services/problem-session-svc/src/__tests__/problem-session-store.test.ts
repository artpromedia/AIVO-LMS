import { describe, expect, it } from "vitest";
import {
  InMemoryProblemSessionStore,
  ProblemSessionNotFoundError,
} from "../services/problem-session-store.js";

function makeStore() {
  return new InMemoryProblemSessionStore();
}

describe("InMemoryProblemSessionStore", () => {
  it("creates a session with required fields", async () => {
    const store = makeStore();
    const session = await store.createSession({
      tenantId: "t1",
      learnerId: "l1",
      subject: "math",
      source: "baseline",
      skillCode: "MATH.GEOM.AREA",
    });
    expect(session.tenantId).toBe("t1");
    expect(session.status).toBe("active");
    expect(session.subject).toBe("math");
    expect(session.skillCode).toBe("MATH.GEOM.AREA");
  });

  it("appends events with redacted payload", async () => {
    const store = makeStore();
    const session = await store.createSession({
      tenantId: "t1",
      learnerId: "l1",
      subject: "math",
      source: "lesson",
    });
    const event = await store.appendEvent({
      problemSessionId: session.id,
      eventType: "answer_attempted",
      payload: { correct: true, parentPrivateNotes: "very personal note" },
    });
    expect(event.eventPayload.parentPrivateNotes).toBe("very personal note");
    expect(event.redactedPayload.parentPrivateNotes).toBe("[redacted]");
  });

  it("appends attempts with auto-incrementing attempt numbers", async () => {
    const store = makeStore();
    const session = await store.createSession({
      tenantId: "t1",
      learnerId: "l1",
      subject: "math",
      source: "lesson",
    });
    const a1 = await store.appendAttempt({
      problemSessionId: session.id,
      response: { answer: 12 },
      correct: false,
      latencyMs: 1000,
    });
    const a2 = await store.appendAttempt({
      problemSessionId: session.id,
      response: { answer: 32 },
      correct: true,
      latencyMs: 1500,
    });
    expect(a1.attemptNumber).toBe(1);
    expect(a2.attemptNumber).toBe(2);
    const attempts = await store.listAttemptsForSession(session.id);
    expect(attempts).toHaveLength(2);
  });

  it("appends snapshots with stroke counts", async () => {
    const store = makeStore();
    const session = await store.createSession({
      tenantId: "t1",
      learnerId: "l1",
      subject: "math",
      source: "homework",
    });
    const snap = await store.appendSnapshot({
      problemSessionId: session.id,
      surfaceId: "surf-1",
      snapshotType: "ink",
      snapshot: { strokes: [] },
      strokeCount: 12,
    });
    expect(snap.strokeCount).toBe(12);
    expect(snap.surfaceId).toBe("surf-1");
  });

  it("marks a session as completed", async () => {
    const store = makeStore();
    const session = await store.createSession({
      tenantId: "t1",
      learnerId: "l1",
      subject: "math",
      source: "lesson",
    });
    const completed = await store.completeSession(session.id);
    expect(completed?.status).toBe("completed");
    expect(completed?.completedAt).toBeDefined();
  });

  it("returns undefined when completing missing session", async () => {
    const store = makeStore();
    expect(await store.completeSession("missing")).toBeUndefined();
  });

  it("throws when appending an event to a missing session", async () => {
    const store = makeStore();
    await expect(
      store.appendEvent({
        problemSessionId: "missing",
        eventType: "answer_attempted",
      }),
    ).rejects.toBeInstanceOf(ProblemSessionNotFoundError);
  });

  it("lists recent sessions for a learner", async () => {
    const store = makeStore();
    await store.createSession({
      tenantId: "t1",
      learnerId: "l1",
      subject: "math",
      source: "lesson",
    });
    await store.createSession({
      tenantId: "t1",
      learnerId: "l1",
      subject: "science",
      source: "lesson",
    });
    await store.createSession({
      tenantId: "t1",
      learnerId: "l2",
      subject: "ela",
      source: "lesson",
    });
    const recent = await store.listRecentForLearner("l1");
    expect(recent).toHaveLength(2);
    expect(recent.every((s) => s.learnerId === "l1")).toBe(true);
  });
});
