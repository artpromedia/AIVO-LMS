import { describe, it, expect } from "vitest";
import {
  ccssMathKindergarten,
  ngssK2PhysicalScience,
  SEED_GRAPHS,
  getSeedGraph,
  validateGraph,
  indexGraph,
  topologicalSort,
  findByFrameworkCode,
  prerequisiteClosure,
} from "../index.js";
import type { SkillGraph } from "../index.js";

describe("seed graphs", () => {
  it("exposes both CCSS-Math K and NGSS K-2 Physical Science", () => {
    expect(SEED_GRAPHS.length).toBeGreaterThanOrEqual(2);
    expect(getSeedGraph("ccss-math-k")).toBe(ccssMathKindergarten);
    expect(getSeedGraph("ngss-k2-physical-science")).toBe(ngssK2PhysicalScience);
    expect(getSeedGraph("nope")).toBeUndefined();
  });

  it("CCSS-Math K seed validates clean", () => {
    expect(validateGraph(ccssMathKindergarten)).toEqual([]);
  });

  it("NGSS K-2 Physical Science seed validates clean", () => {
    expect(validateGraph(ngssK2PhysicalScience)).toEqual([]);
  });

  it("every seed graph validates clean (no duplicate ids, no cycles, prereqs resolve)", () => {
    for (const seed of SEED_GRAPHS) {
      expect(validateGraph(seed), `seed "${seed.id}" has issues`).toEqual([]);
    }
  });

  it("every seed graph is registered under its own id and is unique", () => {
    const ids = SEED_GRAPHS.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const seed of SEED_GRAPHS) {
      expect(getSeedGraph(seed.id)).toBe(seed);
    }
  });

  it("CCSS-Math K seed topo-sorts (no cycles)", () => {
    const ordered = topologicalSort(ccssMathKindergarten);
    expect(ordered.length).toBe(ccssMathKindergarten.skills.length);
    // K.CC.A.1 is foundational => it must precede K.CC.B.4 in the topo order.
    const idxOf = (id: string) => ordered.findIndex((s) => s.id === id);
    expect(idxOf("ccss-math.K.CC.A.1")).toBeLessThan(idxOf("ccss-math.K.CC.B.4"));
    expect(idxOf("ccss-math.K.CC.B.4")).toBeLessThan(idxOf("ccss-math.K.CC.B.5"));
  });

  it("findByFrameworkCode returns the matching skill", () => {
    const hits = findByFrameworkCode(ccssMathKindergarten, "CCSS-Math", "K.CC.A.1");
    expect(hits.length).toBe(1);
    expect(hits[0].id).toBe("ccss-math.K.CC.A.1");
  });

  it("prerequisiteClosure returns transitive prereqs (sorted)", () => {
    // K.CC.B.5 -> K.CC.B.4 -> K.CC.A.1
    const closure = prerequisiteClosure(ccssMathKindergarten, "ccss-math.K.CC.B.5");
    expect(closure).toEqual(["ccss-math.K.CC.A.1", "ccss-math.K.CC.B.4"]);
  });
});

describe("validateGraph", () => {
  function graphOf(skills: SkillGraph["skills"]): SkillGraph {
    return {
      id: "test",
      title: "test",
      version: "0",
      source: "test",
      framework: "CCSS-Math",
      subject: "math",
      gradeBand: "K",
      skills,
    };
  }

  it("flags duplicate ids", () => {
    const issues = validateGraph(
      graphOf([
        { id: "a", title: "", description: "", subject: "math", gradeBand: "K", frameworkRefs: [], prerequisites: [] },
        { id: "a", title: "", description: "", subject: "math", gradeBand: "K", frameworkRefs: [], prerequisites: [] },
      ]),
    );
    expect(issues.some((i) => i.code === "duplicate_skill_id")).toBe(true);
  });

  it("flags missing prereq", () => {
    const issues = validateGraph(
      graphOf([
        { id: "a", title: "", description: "", subject: "math", gradeBand: "K", frameworkRefs: [], prerequisites: ["nope"] },
      ]),
    );
    expect(issues.some((i) => i.code === "missing_prerequisite")).toBe(true);
  });

  it("flags self-prereq", () => {
    const issues = validateGraph(
      graphOf([
        { id: "a", title: "", description: "", subject: "math", gradeBand: "K", frameworkRefs: [], prerequisites: ["a"] },
      ]),
    );
    expect(issues.some((i) => i.code === "self_prerequisite")).toBe(true);
  });

  it("detects a 2-cycle", () => {
    const issues = validateGraph(
      graphOf([
        { id: "a", title: "", description: "", subject: "math", gradeBand: "K", frameworkRefs: [], prerequisites: ["b"] },
        { id: "b", title: "", description: "", subject: "math", gradeBand: "K", frameworkRefs: [], prerequisites: ["a"] },
      ]),
    );
    expect(issues.some((i) => i.code === "cycle_detected")).toBe(true);
  });
});

describe("indexGraph / getSkill", () => {
  it("indexes by id", () => {
    const idx = indexGraph(ccssMathKindergarten);
    expect(idx.size).toBe(ccssMathKindergarten.skills.length);
    expect(idx.get("ccss-math.K.CC.A.1")?.title).toMatch(/Count to 100/);
  });
});
