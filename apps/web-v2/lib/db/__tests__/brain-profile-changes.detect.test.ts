/**
 * Sprint C-13 — `detectBrainProfileChange` classification unit tests.
 *
 * The pure heart of the policy: structural vs mastery vs nothing. These pin the
 * exact rule (report §4.2) that the rest of the sprint depends on — without any
 * persistence — so a regression in the classifier is caught here directly.
 */
import { describe, it, expect } from "vitest";
import { detectBrainProfileChange } from "@/lib/db/brain-profile-changes";
import type { LearnerBrainProfileState } from "@/lib/db/types";

/** A minimal state carrying only the fields the detector reads. */
function state(over: Partial<LearnerBrainProfileState> = {}): LearnerBrainProfileState {
  return {
    functioningLevel: "STANDARD",
    activeAccommodations: [],
    activeTutors: [],
    supportDefaults: {
      extendedTime: false,
      readAloud: false,
      speechToText: false,
      visualSchedules: false,
      sensoryBreaks: false,
    },
    masteryLevels: {},
    masteryOverview: [],
    iepProfile: null,
    ...over,
  } as unknown as LearnerBrainProfileState;
}

const base = { source: "regenerate" as const, learnerName: "Maya" };

describe("detectBrainProfileChange — classification", () => {
  it("returns null when nothing meaningful changed", () => {
    expect(detectBrainProfileChange({ before: state(), after: state(), ...base })).toBeNull();
  });

  it("an added accommodation is STRUCTURAL and requires ack", () => {
    const d = detectBrainProfileChange({
      before: state(),
      after: state({ activeAccommodations: ["read_aloud"], supportDefaults: {
        extendedTime: false, readAloud: true, speechToText: false, visualSchedules: false, sensoryBreaks: false,
      } }),
      ...base,
    });
    expect(d).not.toBeNull();
    expect(d!.kind).toBe("structural");
    expect(d!.requiresAck).toBe(true);
    expect(d!.fields).toContain("accommodation.read_aloud");
    expect(d!.summary.toLowerCase()).toContain("read-aloud");
  });

  it("a functioning-level shift is STRUCTURAL", () => {
    const d = detectBrainProfileChange({
      before: state({ functioningLevel: "STANDARD" }),
      after: state({ functioningLevel: "SUPPORTED" }),
      ...base,
    });
    expect(d!.kind).toBe("structural");
    expect(d!.fields).toContain("functioningLevel");
  });

  it("a tutor activation is STRUCTURAL", () => {
    const d = detectBrainProfileChange({
      before: state({ activeTutors: ["nova"] }),
      after: state({ activeTutors: ["nova", "sage"] }),
      ...base,
    });
    expect(d!.kind).toBe("structural");
    expect(d!.fields).toContain("tutor.sage");
  });

  it("an IEP-derived shift is STRUCTURAL", () => {
    const d = detectBrainProfileChange({
      before: state({ iepProfile: null }),
      after: state({ iepProfile: { uploaded: true, categories: ["SLD"], goals: [] } }),
      source: "iep_update",
      learnerName: "Maya",
    });
    expect(d!.kind).toBe("structural");
    expect(d!.fields).toContain("iepProfile");
  });

  it("a mastery-only move is MASTERY and does NOT require ack", () => {
    const d = detectBrainProfileChange({
      before: state({ masteryLevels: { math: 0.4 }, masteryOverview: [{ subjectId: "math", subjectName: "Math", estimate: "growing" }] }),
      after: state({ masteryLevels: { math: 0.9 }, masteryOverview: [{ subjectId: "math", subjectName: "Math", estimate: "confident" }] }),
      source: "engagement_sync",
      learnerName: "Maya",
    });
    expect(d!.kind).toBe("mastery");
    expect(d!.requiresAck).toBe(false);
    expect(d!.fields).toEqual(["masteryLevels.math"]);
  });

  it("structural WINS when both structural and mastery change at once", () => {
    const d = detectBrainProfileChange({
      before: state({ masteryLevels: { math: 0.4 } }),
      after: state({
        masteryLevels: { math: 0.9 },
        activeTutors: ["nova"],
      }),
      ...base,
    });
    expect(d!.kind).toBe("structural");
    expect(d!.requiresAck).toBe(true);
    // The mastery move rides along in the same record's field list.
    expect(d!.fields).toContain("tutor.nova");
    expect(d!.fields).toContain("masteryLevels.math");
  });

  it("a tiny mastery wobble inside one band is NOT a change", () => {
    const d = detectBrainProfileChange({
      before: state({ masteryLevels: { math: 0.50 } }),
      after: state({ masteryLevels: { math: 0.51 } }),
      ...base,
    });
    expect(d).toBeNull();
  });

  it("mastery summary frames a dip as movement, never failure", () => {
    const d = detectBrainProfileChange({
      before: state({ masteryLevels: { reading: 0.8 }, masteryOverview: [{ subjectId: "reading", subjectName: "Reading", estimate: "confident" }] }),
      after: state({ masteryLevels: { reading: 0.4 }, masteryOverview: [{ subjectId: "reading", subjectName: "Reading", estimate: "growing" }] }),
      source: "engagement_sync",
      learnerName: "Maya",
    });
    expect(d!.kind).toBe("mastery");
    const s = d!.summary.toLowerCase();
    expect(s).not.toContain("fail");
    expect(s).not.toContain("dropped");
  });
});
