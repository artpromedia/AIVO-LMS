import { describe, expect, expectTypeOf, it } from "vitest";
import type {
  AnswerAttemptedPayload,
  ProblemSessionEvent,
  ProblemSessionStartedPayload,
} from "../problem-session-events.js";
import type { LearningEventBase } from "../learning-events.js";

describe("problem session event payloads", () => {
  it("requires the standard envelope fields", () => {
    const event: LearningEventBase<ProblemSessionStartedPayload> = {
      eventId: "evt-1",
      eventType: "problem_session_started",
      tenantId: "t1",
      learnerId: "l1",
      occurredAt: new Date().toISOString(),
      sourceService: "assessment-svc",
      correlationId: "corr-1",
      payload: {
        problemSessionId: "ps-1",
        subject: "math",
        skillCode: "MATH.GEOM.AREA",
        source: "baseline",
      },
    };
    expect(event.payload.subject).toBe("math");
  });

  it("typed answer payload retains required attempt fields", () => {
    const payload: AnswerAttemptedPayload = {
      problemSessionId: "ps-1",
      attemptNumber: 2,
      correct: true,
      latencyMs: 1500,
      hintCount: 1,
      score: 1,
    };
    expect(payload.attemptNumber).toBe(2);
  });

  it("discriminated event union narrows by event type", () => {
    expectTypeOf<ProblemSessionEvent<"answer_attempted">>().toMatchTypeOf<
      LearningEventBase<AnswerAttemptedPayload>
    >();
  });
});
