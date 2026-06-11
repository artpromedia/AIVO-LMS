/**
 * Wave E (S11) — write-tool adapter tests.
 *
 * file_evidence: the ledger row always lands, the supplemental mastery
 * signal is HARD-clamped to ±0.05 (property-tested across hostile
 * inputs), and no gradebook row means evidence-only (supplemental never
 * creates baseline truth).
 *
 * propose_recommendation: type policy pre-checked in-process; server
 * policy refusals come back as structured rejections; transport trouble
 * becomes { error } — never a thrown turn.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  clampMasteryDelta,
  executeWriteTool,
  MAX_SUPPLEMENTAL_MASTERY_DELTA,
  type EvidenceRowInput,
  type ProposeRecommendationInput,
  type WriteToolContext,
  type WriteToolDeps,
} from "../src/agent/write-tools.js";
import type { LessonObservation } from "../src/agent/orchestrator.js";

const OBSERVATION: LessonObservation = {
  beatIndex: 4,
  totalBeats: 8,
  beatKind: "guided",
  beatKinds: ["welcome", "goal", "micro", "example", "guided", "guided", "check", "celebrate"],
  prompt: "What is 3 x 4?",
  learnerResponse: "12",
  isCorrect: true,
  skillId: "ccss.3.oa.a.1",
};

const CTX: WriteToolContext = {
  tenantId: "ten-1",
  sessionId: "sess-1",
  learnerId: "lrn-1",
  tutorKey: "nova",
  observation: OBSERVATION,
};

function makeDeps(overrides: Partial<WriteToolDeps> = {}) {
  const evidence: EvidenceRowInput[] = [];
  const masteryApplies: Array<{ skillId: string; delta: number }> = [];
  const proposals: ProposeRecommendationInput[] = [];
  const deps: WriteToolDeps = {
    async insertEvidence(row) {
      evidence.push(row);
    },
    async applySupplementalMastery(input) {
      masteryApplies.push({ skillId: input.skillId, delta: input.delta });
    },
    async proposeRecommendation(input) {
      proposals.push(input);
      return { id: "rec-1" };
    },
    ...overrides,
  };
  return { deps, evidence, masteryApplies, proposals };
}

describe("clampMasteryDelta (property)", () => {
  it("never exceeds ±0.05 for ANY input", () => {
    // Deterministic PRNG so failures replay.
    let seed = 42;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 2 ** 32;
      return seed / 2 ** 32;
    };
    const hostile: unknown[] = [
      Infinity,
      -Infinity,
      NaN,
      "0.9",
      "-7",
      null,
      undefined,
      {},
      [],
      true,
      1e308,
      -1e308,
    ];
    for (let i = 0; i < 500; i += 1) {
      hostile.push((rand() - 0.5) * 20);
    }
    for (const input of hostile) {
      const out = clampMasteryDelta(input);
      assert.ok(Number.isFinite(out), `finite for ${String(input)}`);
      assert.ok(
        Math.abs(out) <= MAX_SUPPLEMENTAL_MASTERY_DELTA + 1e-12,
        `|${out}| ≤ 0.05 for input ${String(input)}`,
      );
    }
    // Values inside the bound pass through unchanged.
    assert.equal(clampMasteryDelta(0.03), 0.03);
    assert.equal(clampMasteryDelta(-0.05), -0.05);
    assert.equal(clampMasteryDelta(0), 0);
  });
});

describe("file_evidence", () => {
  it("writes the ledger row and applies the clamped nudge", async () => {
    const { deps, evidence, masteryApplies } = makeDeps();
    const result = await executeWriteTool(
      "file_evidence",
      { kind: "mastery_signal", note: "Solved 3 multiplication items independently.", mastery_delta: 0.9 },
      CTX,
      deps,
    );
    assert.equal(result.filed, true);
    assert.equal(result.applied_mastery_delta, MAX_SUPPLEMENTAL_MASTERY_DELTA);
    assert.ok(String(result.note).includes("clamped"));
    assert.equal(evidence.length, 1);
    assert.equal(evidence[0].masteryDelta, MAX_SUPPLEMENTAL_MASTERY_DELTA);
    assert.equal(evidence[0].skillId, "ccss.3.oa.a.1");
    assert.deepEqual(masteryApplies, [
      { skillId: "ccss.3.oa.a.1", delta: MAX_SUPPLEMENTAL_MASTERY_DELTA },
    ]);
  });

  it("zero / absent delta files evidence without touching mastery", async () => {
    const { deps, evidence, masteryApplies } = makeDeps();
    const result = await executeWriteTool(
      "file_evidence",
      { kind: "observation", note: "Counts on fingers for sums over five." },
      CTX,
      deps,
    );
    assert.equal(result.filed, true);
    assert.equal(evidence.length, 1);
    assert.equal(masteryApplies.length, 0);
  });

  it("rejects bad kinds and empty notes without writing", async () => {
    const { deps, evidence } = makeDeps();
    const badKind = await executeWriteTool(
      "file_evidence",
      { kind: "diagnosis", note: "long enough note" },
      CTX,
      deps,
    );
    assert.ok(typeof badKind.error === "string");
    const badNote = await executeWriteTool(
      "file_evidence",
      { kind: "observation", note: "x" },
      CTX,
      deps,
    );
    assert.ok(typeof badNote.error === "string");
    assert.equal(evidence.length, 0);
  });

  it("ledger insert failure surfaces as { error }, never a throw", async () => {
    const { deps } = makeDeps({
      insertEvidence: async () => {
        throw new Error("db down");
      },
    });
    const result = await executeWriteTool(
      "file_evidence",
      { kind: "observation", note: "long enough note" },
      CTX,
      deps,
    );
    assert.equal(result.error, "db down");
  });
});

describe("propose_recommendation", () => {
  const GOOD_ARGS = {
    type: "tutor_strategy_change",
    title: "Worked examples before practice",
    parent_summary:
      "A worked example right before practice helped Sky solve similar problems independently.",
    proposed_value: { strategy: "worked_example_first" },
    confidence: 0.7,
  };

  it("files a pending proposal through the service", async () => {
    const { deps, proposals } = makeDeps();
    const result = await executeWriteTool("propose_recommendation", GOOD_ARGS, CTX, deps);
    assert.deepEqual(result, { proposed: true, recommendation_id: "rec-1", status: "PENDING" });
    assert.equal(proposals.length, 1);
    assert.equal(proposals[0].learnerId, "lrn-1");
    assert.equal(proposals[0].tutorKey, "nova");
    assert.equal(proposals[0].sessionId, "sess-1");
  });

  it("pre-checks the type policy in-process", async () => {
    const { deps, proposals } = makeDeps();
    const result = await executeWriteTool(
      "propose_recommendation",
      { ...GOOD_ARGS, type: "functioning_level_change" },
      CTX,
      deps,
    );
    assert.ok(typeof result.error === "string" && result.error.includes("not tutor-proposable"));
    assert.equal(proposals.length, 0, "never reaches the service");
  });

  it("passes server policy rejections through as structured results", async () => {
    const { deps } = makeDeps({
      proposeRecommendation: async () => ({ rejected: "cooldown", detail: "retry in 9 days" }),
    });
    const result = await executeWriteTool("propose_recommendation", GOOD_ARGS, CTX, deps);
    assert.deepEqual(result, { proposed: false, rejected: "cooldown", detail: "retry in 9 days" });
  });

  it("requires decidable text", async () => {
    const { deps } = makeDeps();
    const result = await executeWriteTool(
      "propose_recommendation",
      { ...GOOD_ARGS, parent_summary: "do it" },
      CTX,
      deps,
    );
    assert.ok(typeof result.error === "string");
  });
});
