import { describe, expect, it } from "vitest";
import type { Skill, SkillMastery } from "@/lib/db/types";
import { MASTERY_THRESHOLD, selectNextSkills } from "./select-next-skills";

const T = "t_test";
const L = "lrn_test";

function skill(id: string, prerequisites: string[] = [], gradeBand = "K-1"): Skill {
  return { id, subjectId: "sub-1", slug: id, name: id, gradeBand, prerequisites };
}

function mastery(skillId: string, score: number): SkillMastery {
  return {
    learnerId: L,
    tenantId: T,
    skillId,
    subjectId: "sub-1",
    score,
    level: score >= MASTERY_THRESHOLD ? "on_grade_level" : "emerging",
    confidence: 0.6,
    needsReview: false,
    lastEvaluatedAt: null,
  };
}

describe("selectNextSkills", () => {
  it("never returns a locked skill in the frontier", () => {
    const r = selectNextSkills({
      skills: [skill("a"), skill("b", ["a"]), skill("c", ["b"])],
      skillMasteries: [mastery("a", 0.2)],
    });
    expect(r.frontier).toEqual(["a"]);
    expect(r.locked.map((l) => l.skillId).sort()).toEqual(["b", "c"]);
    expect(r.locked.find((l) => l.skillId === "b")?.missingPrerequisites).toEqual(["a"]);
  });

  it("mastering a prerequisite unlocks its dependents on the next call", () => {
    const skills = [skill("a"), skill("b", ["a"])];
    const before = selectNextSkills({ skills, skillMasteries: [mastery("a", 0.5)] });
    expect(before.frontier).toEqual(["a"]);
    const after = selectNextSkills({ skills, skillMasteries: [mastery("a", 0.7)] });
    expect(after.frontier).toEqual(["b"]);
    expect(after.mastered).toEqual(["a"]);
  });

  it("respects topological order in a chain (foundations first)", () => {
    // All unlocked (b's prereq mastered), depth orders c after b.
    const r = selectNextSkills({
      skills: [skill("c", ["b"]), skill("b", ["a"]), skill("a")],
      skillMasteries: [mastery("a", 0.9), mastery("b", 0.7)],
    });
    // a and b mastered; only c remains, unlocked because b >= threshold.
    expect(r.frontier).toEqual(["c"]);
    expect(r.mastered.sort()).toEqual(["a", "b"]);
  });

  it("handles a diamond: both branches unlock before the join", () => {
    const skills = [skill("d", ["b", "c"]), skill("b", ["a"]), skill("c", ["a"]), skill("a")];
    const r = selectNextSkills({ skills, skillMasteries: [mastery("a", 0.8)] });
    expect(r.frontier).toEqual(["b", "c"]); // depth 1, id tiebreak
    expect(r.locked.find((l) => l.skillId === "d")?.missingPrerequisites.sort()).toEqual([
      "b",
      "c",
    ]);
  });

  it("does not infinite-loop on cycles; cycle members are quarantined last", () => {
    const skills = [skill("x", ["y"]), skill("y", ["x"]), skill("a")];
    const r = selectNextSkills({ skills, skillMasteries: [] });
    expect(r.issues.some((i) => i.code === "cycle_detected")).toBe(true);
    // Cycle members are reachable (never silently dropped) but come last.
    expect(r.frontier[0]).toBe("a");
    expect(r.frontier.slice(1).sort()).toEqual(["x", "y"]);
  });

  it("drops unknown and self prerequisites with issues instead of crashing", () => {
    const skills = [skill("a", ["ghost", "a"])];
    const r = selectNextSkills({ skills, skillMasteries: [] });
    expect(r.frontier).toEqual(["a"]);
    expect(r.issues.some((i) => i.code === "missing_prerequisite")).toBe(true);
    expect(r.issues.some((i) => i.code === "self_prerequisite")).toBe(true);
  });

  it("returns an empty frontier for a fully mastered subject", () => {
    const skills = [skill("a"), skill("b", ["a"])];
    const r = selectNextSkills({
      skills,
      skillMasteries: [mastery("a", 0.9), mastery("b", 0.8)],
    });
    expect(r.frontier).toEqual([]);
    expect(r.mastered.sort()).toEqual(["a", "b"]);
  });

  it("prefers skills near the delivery level, ascending toward grade band", () => {
    // Same depth (no prereqs); delivery level 2, enrolled grade 5.
    const skills = [
      skill("far-above", [], "5"),
      skill("at-level", [], "2"),
      skill("below", [], "K"),
      skill("just-above", [], "3"),
    ];
    const r = selectNextSkills({
      skills,
      skillMasteries: [],
      deliveryLevel: "2",
      gradeBand: "5",
    });
    expect(r.frontier).toEqual(["at-level", "below", "just-above", "far-above"]);
  });

  it("treats missing mastery rows as unmastered score 0", () => {
    const r = selectNextSkills({
      skills: [skill("a"), skill("b", ["a"])],
      skillMasteries: [],
    });
    expect(r.frontier).toEqual(["a"]);
    expect(r.locked.map((l) => l.skillId)).toEqual(["b"]);
  });
});
