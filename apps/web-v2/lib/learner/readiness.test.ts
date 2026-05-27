import { describe, expect, it } from "vitest";
import type { ReadinessState } from "@/lib/db/types";
import { READINESS_LABEL, READINESS_NEXT_STEP, READINESS_TONE } from "@/lib/learner/readiness";

const ALL_STATES: ReadinessState[] = [
  "profile_created",
  "assessment_needed",
  "iep_optional",
  "baseline_needed",
  "brain_building",
  "brain_review_needed",
  "ready_for_today_mission",
  "active_learning",
];

describe("learner readiness map coverage", () => {
  it("has label, tone, and next step entries for every readiness state", () => {
    for (const state of ALL_STATES) {
      expect(READINESS_LABEL[state]).toBeTruthy();
      expect(READINESS_TONE[state]).toBeTruthy();
      expect(READINESS_NEXT_STEP[state]).toBeTruthy();
    }
  });

  it("never self-loops to the parent learner detail page", () => {
    const selfPage = "/parent/learners/{learnerId}";
    for (const state of ALL_STATES) {
      expect(READINESS_NEXT_STEP[state].hrefTemplate).not.toBe(selfPage);
    }
  });
});
