import { describe, expect, it } from "vitest";
import {
  isLearnerScopedKey,
  learnerScopedQueryKey,
} from "../react/learner-scoped.js";

describe("learnerScopedQueryKey", () => {
  it("namespaces by (learner, learnerId, viewerRole, resource)", () => {
    expect(learnerScopedQueryKey("l-1", "parent", "profile")).toEqual([
      "learner",
      "l-1",
      "parent",
      "profile",
    ]);
  });

  it("appends extra positional disambiguators", () => {
    expect(
      learnerScopedQueryKey("l-1", "teacher", "sessions", { from: "2026-01-01" }, 1),
    ).toEqual(["learner", "l-1", "teacher", "sessions", { from: "2026-01-01" }, 1]);
  });

  it("separates parent and teacher slices of the same learner", () => {
    const parent = learnerScopedQueryKey("l-1", "parent", "iep");
    const teacher = learnerScopedQueryKey("l-1", "teacher", "iep");
    expect(parent).not.toEqual(teacher);
  });

  it("separates therapist and caregiver slices of the same learner", () => {
    const therapist = learnerScopedQueryKey("l-1", "therapist", "iep");
    const caregiver = learnerScopedQueryKey("l-1", "caregiver", "iep");
    expect(therapist[2]).toBe("therapist");
    expect(caregiver[2]).toBe("caregiver");
    expect(therapist).not.toEqual(caregiver);
  });

  it("matrix: every (learnerId, viewerRole) yields a unique key", () => {
    const learners = ["l-1", "l-2", "l-3"];
    const roles = ["parent", "teacher", "therapist", "caregiver", "school_admin"];
    const keys = new Set<string>();
    for (const l of learners) {
      for (const r of roles) {
        const k = learnerScopedQueryKey(l, r, "profile");
        keys.add(JSON.stringify(k));
      }
    }
    expect(keys.size).toBe(learners.length * roles.length);
  });
});

describe("isLearnerScopedKey", () => {
  it("recognises a well-formed learner key", () => {
    expect(isLearnerScopedKey(["learner", "l-1", "parent", "profile"])).toBe(true);
  });

  it("rejects keys with the wrong root", () => {
    expect(isLearnerScopedKey(["learning", "l-1", "parent", "profile"])).toBe(false);
  });

  it("rejects keys that are too short", () => {
    expect(isLearnerScopedKey(["learner", "l-1", "parent"])).toBe(false);
  });

  it("rejects keys whose id components are not strings", () => {
    expect(isLearnerScopedKey(["learner", 1, "parent", "profile"])).toBe(false);
    expect(isLearnerScopedKey(["learner", "l-1", 2, "profile"])).toBe(false);
  });

  it("can scope predicate to a specific learnerId", () => {
    expect(
      isLearnerScopedKey(["learner", "l-1", "parent", "profile"], "l-1"),
    ).toBe(true);
    expect(
      isLearnerScopedKey(["learner", "l-1", "parent", "profile"], "l-2"),
    ).toBe(false);
  });
});
