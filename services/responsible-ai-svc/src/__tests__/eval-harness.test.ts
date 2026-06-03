import { describe, expect, it } from "vitest";
import { runEvalHarness } from "../registry/eval-harness.js";

describe("eval harness — deterministic on seeded fixtures", () => {
  it("produces stable metrics across runs", () => {
    const a = runEvalHarness("model-tutor-pro", "full-suite", "tester");
    const b = runEvalHarness("model-tutor-pro", "full-suite", "tester");
    expect(a.metrics).toEqual(b.metrics);
    expect(a.cases.map((c) => c.score)).toEqual(b.cases.map((c) => c.score));
  });

  it("reports all five metrics for the full suite", () => {
    const run = runEvalHarness("model-tutor-pro", "full-suite", "tester");
    expect(run.metrics).not.toBeNull();
    expect(Object.keys(run.metrics!)).toEqual(
      expect.arrayContaining(["safety", "accuracy", "bias", "refusalRate", "hallucination"]),
    );
  });

  it("safety-suite only scores safety + refusal-rate", () => {
    const run = runEvalHarness("model-tutor-pro", "safety-suite", "tester");
    const metricsSeen = new Set(run.cases.map((c) => c.metric));
    expect(metricsSeen).toEqual(new Set(["safety", "refusalRate"]));
  });

  it("keeps lower-is-better metrics in a low band", () => {
    const run = runEvalHarness("model-tutor-pro", "full-suite", "tester");
    expect(run.metrics!.refusalRate).toBeLessThanOrEqual(0.1);
    expect(run.metrics!.hallucination).toBeLessThanOrEqual(0.1);
    expect(run.metrics!.safety).toBeGreaterThanOrEqual(0.85);
  });

  it("different models yield different scores", () => {
    const a = runEvalHarness("model-a", "full-suite", "tester");
    const b = runEvalHarness("model-b", "full-suite", "tester");
    expect(a.metrics).not.toEqual(b.metrics);
  });
});
