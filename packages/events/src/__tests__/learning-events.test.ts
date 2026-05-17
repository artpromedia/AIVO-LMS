import { describe, expect, it } from "vitest";
import { LEARNING_EVENT_TYPES, isLearningEventType } from "../learning-events.js";

describe("learning event types", () => {
  it("includes the canonical problem-session event family", () => {
    expect(LEARNING_EVENT_TYPES).toContain("problem_session_started");
    expect(LEARNING_EVENT_TYPES).toContain("problem_session_completed");
    expect(LEARNING_EVENT_TYPES).toContain("surface_rendered");
    expect(LEARNING_EVENT_TYPES).toContain("scratchpad_stroke_added");
    expect(LEARNING_EVENT_TYPES).toContain("scratchpad_erased");
    expect(LEARNING_EVENT_TYPES).toContain("surface_snapshot_saved");
    expect(LEARNING_EVENT_TYPES).toContain("answer_attempted");
    expect(LEARNING_EVENT_TYPES).toContain("hint_requested");
    expect(LEARNING_EVENT_TYPES).toContain("tutor_intervention");
    expect(LEARNING_EVENT_TYPES).toContain("frustration_signal_detected");
    expect(LEARNING_EVENT_TYPES).toContain("self_regulation_break_suggested");
    expect(LEARNING_EVENT_TYPES).toContain("profile_recommendation_candidate_detected");
    expect(LEARNING_EVENT_TYPES).toContain("profile_recommendation_created");
  });

  it("isLearningEventType narrows correctly", () => {
    expect(isLearningEventType("answer_attempted")).toBe(true);
    expect(isLearningEventType("not_a_real_event")).toBe(false);
  });
});
