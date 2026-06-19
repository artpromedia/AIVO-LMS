/**
 * Unit tests for the in-memory recommendation engine.
 *
 * Covers the truthful generation rules (advance vs support vs skip, cap,
 * confidence ordering, stable ids) and the decision round-trip
 * (accept / add-context / decline / undo) overlaid back onto the list.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// Controllable mastery so generation is deterministic and hermetic.
const masteryRef: {
  skillMasteries: Array<{ subjectId: string; score: number; lastEvaluatedAt: string | null }>;
} = { skillMasteries: [] };

vi.mock("@/lib/db/repos", () => ({
  getMasteryMap: vi.fn(async () => ({ skillMasteries: masteryRef.skillMasteries })),
  getLearner: vi.fn(async () => ({ id: "lrn_1", firstName: "Liam", displayName: "Liam H" })),
  listSubjects: vi.fn(async () => [
    { id: "subj_math", name: "Mathematics" },
    { id: "subj_read", name: "Reading" },
  ]),
}));

import {
  buildCandidatesFromMastery,
  engineList,
  engineRespond,
  __resetRecommendationEngine,
} from "./engine";

const TENANT = "t_demo";
const LEARNER = "lrn_1";

function skills(subjectId: string, scores: number[]) {
  return scores.map((score) => ({ subjectId, score, lastEvaluatedAt: "2026-06-10T10:00:00.000Z" }));
}

beforeEach(() => {
  __resetRecommendationEngine();
  masteryRef.skillMasteries = [];
});

describe("buildCandidatesFromMastery (generation rules)", () => {
  const subjectName = (id: string) => (id === "subj_math" ? "Mathematics" : "Reading");

  it("proposes advancement for a consistently-mastered subject", () => {
    const recs = buildCandidatesFromMastery(LEARNER, "Liam", skills("subj_math", [0.9, 0.85, 0.8]), subjectName);
    expect(recs).toHaveLength(1);
    expect(recs[0]).toMatchObject({
      id: "rec_lrn_1_subj_math_advance",
      type: "pace_advance",
      status: "PENDING",
    });
    expect(recs[0].title).toContain("Mathematics");
    expect(recs[0].evidence[0].summary).toContain("3 skills");
  });

  it("proposes extra support for a struggling subject", () => {
    const recs = buildCandidatesFromMastery(LEARNER, "Liam", skills("subj_read", [0.3, 0.4, 0.2]), subjectName);
    expect(recs[0]).toMatchObject({ id: "rec_lrn_1_subj_read_support", type: "support_add" });
  });

  it("skips subjects in the comfortable middle and those with too few skills", () => {
    expect(buildCandidatesFromMastery(LEARNER, "Liam", skills("subj_math", [0.6, 0.65, 0.6]), subjectName)).toEqual([]);
    expect(buildCandidatesFromMastery(LEARNER, "Liam", skills("subj_math", [0.95, 0.95]), subjectName)).toEqual([]);
  });

  it("caps the list and orders by confidence (strongest signal first)", () => {
    const rows = [
      ...skills("subj_math", [0.99, 0.99, 0.99]), // very strong advance
      ...skills("subj_read", [0.8, 0.79, 0.78]), // weaker advance
    ];
    const recs = buildCandidatesFromMastery(LEARNER, "Liam", rows, subjectName);
    expect(recs.length).toBeLessThanOrEqual(4);
    expect(recs[0].id).toBe("rec_lrn_1_subj_math_advance");
  });
});

describe("engineList / engineRespond (decision round-trip)", () => {
  beforeEach(() => {
    masteryRef.skillMasteries = [
      ...skills("subj_math", [0.9, 0.88, 0.86]), // advance
      ...skills("subj_read", [0.3, 0.35, 0.25]), // support
    ];
  });

  it("lists generated recommendations as pending", async () => {
    const all = await engineList(LEARNER, TENANT);
    expect(all.map((r) => r.status)).toEqual(["PENDING", "PENDING"]);
  });

  it("accept marks APPLIED and stamps appliedAt", async () => {
    const rec = await engineRespond(LEARNER, TENANT, "rec_lrn_1_subj_math_advance", "accept");
    expect(rec?.status).toBe("APPLIED");
    expect(rec?.appliedAt).toBeTruthy();
    const all = await engineList(LEARNER, TENANT);
    expect(all.find((r) => r.id === "rec_lrn_1_subj_math_advance")?.status).toBe("APPLIED");
  });

  it("add_context marks CONTEXT_ADDED (and is undoable back to pending)", async () => {
    const ctx = await engineRespond(LEARNER, TENANT, "rec_lrn_1_subj_read_support", "add_context", {
      context: "He has speech therapy Tuesday mornings.",
    });
    expect(ctx?.status).toBe("CONTEXT_ADDED");

    const undone = await engineRespond(LEARNER, TENANT, "rec_lrn_1_subj_read_support", "undo");
    expect(undone?.status).toBe("PENDING");
    const all = await engineList(LEARNER, TENANT);
    expect(all.find((r) => r.id === "rec_lrn_1_subj_read_support")?.status).toBe("PENDING");
  });

  it("decline records the reason", async () => {
    const rec = await engineRespond(LEARNER, TENANT, "rec_lrn_1_subj_math_advance", "decline", {
      reason: "Too much for now",
    });
    expect(rec).toMatchObject({ status: "DECLINED", declineReason: "Too much for now" });
  });

  it("returns null for an unknown recommendation id", async () => {
    expect(await engineRespond(LEARNER, TENANT, "rec_nope", "accept")).toBeNull();
  });
});
