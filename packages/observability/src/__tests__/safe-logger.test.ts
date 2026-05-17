import { describe, expect, it } from "vitest";
import { buildSafeLogEntry, redactForLogging } from "../safe-logger.js";
import { LEARNING_TRACE_EVENTS, buildLearningTrace } from "../learning-traces.js";
import { buildLlmTrace } from "../llm-traces.js";

describe("redactForLogging", () => {
  it("redacts sensitive top-level keys", () => {
    const out = redactForLogging({
      iepText: "long IEP",
      parentPrivateNotes: "private",
      visible: "ok",
    });
    expect(out.iepText).toBe("[redacted]");
    expect(out.parentPrivateNotes).toBe("[redacted]");
    expect(out.visible).toBe("ok");
  });

  it("redacts sensitive keys recursively", () => {
    const out = redactForLogging({
      details: { medicalNotes: "diagnosis" },
    });
    const details = out.details as Record<string, unknown>;
    expect(details.medicalNotes).toBe("[redacted]");
  });

  it("truncates very long strings", () => {
    const long = "x".repeat(500);
    const out = redactForLogging({ note: long });
    expect((out.note as string).length).toBeLessThanOrEqual(241);
  });

  it("redacts api keys and tokens", () => {
    const out = redactForLogging({ apiKey: "k", token: "t" });
    expect(out.apiKey).toBe("[redacted]");
    expect(out.token).toBe("[redacted]");
  });
});

describe("buildSafeLogEntry", () => {
  it("wraps level + message + payload and redacts", () => {
    const entry = buildSafeLogEntry("info", "lesson generated", {
      iepText: "leak",
      lessonId: "ls1",
    });
    expect(entry.level).toBe("info");
    expect(entry.message).toBe("lesson generated");
    expect(entry.payload.iepText).toBe("[redacted]");
    expect(entry.payload.lessonId).toBe("ls1");
  });
});

describe("buildLearningTrace", () => {
  it("includes every documented event in the union", () => {
    expect(LEARNING_TRACE_EVENTS).toContain("lesson_generation_started");
    expect(LEARNING_TRACE_EVENTS).toContain("responsible_ai_violation_detected");
    expect(LEARNING_TRACE_EVENTS).toContain("problem_session_completed");
  });

  it("redacts trace payload", () => {
    const trace = buildLearningTrace(
      "lesson_generation_completed",
      { ocrText: "raw", subject: "math" },
      { tenantId: "t1", learnerId: "l1" },
    );
    expect(trace.payload.ocrText).toBe("[redacted]");
    expect(trace.payload.subject).toBe("math");
  });
});

describe("buildLlmTrace", () => {
  it("redacts the outcome payload", () => {
    const trace = buildLlmTrace({
      provider: "openai",
      model: "x",
      outcome: { parentPrivateNotes: "leak", successful: true },
    });
    expect(trace.outcome.parentPrivateNotes).toBe("[redacted]");
    expect(trace.outcome.successful).toBe(true);
  });
});
