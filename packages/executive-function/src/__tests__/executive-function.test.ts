import { describe, it, expect } from "vitest";
import {
  breakDownTask,
  StuckDetector,
  TimeOfDayMemory,
  bucketLocalHour,
  nextStepPrompt,
} from "../index.js";

describe("breakDownTask", () => {
  it("emits a generic 4-step plan when no steps supplied", () => {
    const b = breakDownTask({ taskId: "t1", title: "Write 3 sentences" });
    expect(b.steps).toHaveLength(4);
    expect(b.totalWeight).toBe(1 + 2 + 4 + 2);
    expect(b.steps[0].id).toBe("t1.s1");
  });

  it("uses author-supplied steps and clamps weights", () => {
    const b = breakDownTask({
      taskId: "t2",
      title: "Math",
      steps: [
        { label: "Look at picture", weight: 99, modality: "visual" },
        { label: "Count", weight: 0, modality: "kinesthetic" },
      ],
    });
    expect(b.steps[0].weight).toBe(5);
    expect(b.steps[1].weight).toBe(1);
    expect(b.totalWeight).toBe(6);
  });
});

describe("StuckDetector", () => {
  it("does not fire below the stuck threshold", () => {
    const d = new StuckDetector({ stuckMs: 60_000 });
    d.advance("s1", 0);
    expect(d.tick({ stepId: "s1", nowMs: 30_000 })).toBeNull();
  });

  it("fires once the learner exceeds the stuck threshold", () => {
    const d = new StuckDetector({ stuckMs: 60_000 });
    d.advance("s1", 0);
    const p = d.tick({ stepId: "s1", nowMs: 65_000 });
    expect(p).not.toBeNull();
    expect(p!.kind).toBe("try-different-modality");
    expect(p!.dwellMs).toBe(65_000);
  });

  it("escalates to ask-for-help after multiple modalities tried", () => {
    const d = new StuckDetector({ stuckMs: 60_000 });
    d.advance("s1", 0);
    const p = d.tick({ stepId: "s1", nowMs: 65_000, modalitiesTried: 2 });
    expect(p!.kind).toBe("ask-for-help");
  });

  it("switches to take-a-breath when frustration is active", () => {
    const d = new StuckDetector({ stuckMs: 60_000 });
    d.advance("s1", 0);
    const p = d.tick({ stepId: "s1", nowMs: 65_000, affect: "frustration" });
    expect(p!.kind).toBe("take-a-breath");
  });

  it("respects the cooldown — does not nag", () => {
    const d = new StuckDetector({ stuckMs: 60_000, cooldownMs: 30_000 });
    d.advance("s1", 0);
    expect(d.tick({ stepId: "s1", nowMs: 65_000 })).not.toBeNull();
    expect(d.tick({ stepId: "s1", nowMs: 70_000 })).toBeNull();
    expect(d.tick({ stepId: "s1", nowMs: 96_000 })).not.toBeNull();
  });

  it("clears state when the learner advances", () => {
    const d = new StuckDetector({ stuckMs: 60_000 });
    d.advance("s1", 0);
    d.advance("s2", 70_000);
    // Time on s2 = 0; should not fire.
    expect(d.tick({ stepId: "s2", nowMs: 90_000 })).toBeNull();
  });
});

describe("TimeOfDayMemory", () => {
  it("buckets local hours correctly", () => {
    expect(bucketLocalHour(6)).toBe("early-morning");
    expect(bucketLocalHour(9)).toBe("morning");
    expect(bucketLocalHour(12)).toBe("midday");
    expect(bucketLocalHour(15)).toBe("afternoon");
    expect(bucketLocalHour(20)).toBe("evening");
  });

  it("ranks windows by composite what-worked score", () => {
    const m = new TimeOfDayMemory();
    m.record({ timeOfDay: "morning", dayOfWeek: 1, accuracy: 0.9, frustrationRate: 0.05, attentionMinutes: 25 });
    m.record({ timeOfDay: "morning", dayOfWeek: 2, accuracy: 0.85, frustrationRate: 0.1, attentionMinutes: 22 });
    m.record({ timeOfDay: "afternoon", dayOfWeek: 1, accuracy: 0.5, frustrationRate: 0.5, attentionMinutes: 8 });
    m.record({ timeOfDay: "afternoon", dayOfWeek: 2, accuracy: 0.45, frustrationRate: 0.6, attentionMinutes: 6 });
    const stats = m.stats();
    expect(stats[0].timeOfDay).toBe("morning");
    expect(stats[stats.length - 1].timeOfDay).toBe("afternoon");
    expect(m.bestWindow()?.timeOfDay).toBe("morning");
  });

  it("requires ≥2 observations before endorsing a window", () => {
    const m = new TimeOfDayMemory();
    m.record({ timeOfDay: "morning", dayOfWeek: 1, accuracy: 0.95, frustrationRate: 0.0, attentionMinutes: 30 });
    expect(m.bestWindow()).toBeNull();
  });

  it("round-trips via toJSON / fromJSON", () => {
    const m = new TimeOfDayMemory();
    m.record({ timeOfDay: "morning", dayOfWeek: 1, accuracy: 0.9, frustrationRate: 0.05, attentionMinutes: 25 });
    const m2 = TimeOfDayMemory.fromJSON(m.toJSON());
    expect(m2.toJSON()).toEqual(m.toJSON());
  });
});

describe("nextStepPrompt", () => {
  it("returns the first incomplete step + progress", () => {
    const b = breakDownTask({ taskId: "t1", title: "x" });
    const r = nextStepPrompt({ breakdown: b, completedStepIds: ["t1.s1"] });
    expect(r.next?.id).toBe("t1.s2");
    // Completed weight 1, total 9.
    expect(r.progress).toBeCloseTo(1 / 9, 5);
    expect(r.message).toContain("Next:");
  });

  it("returns null + done message when all steps complete", () => {
    const b = breakDownTask({ taskId: "t1", title: "x" });
    const r = nextStepPrompt({
      breakdown: b,
      completedStepIds: b.steps.map((s) => s.id),
    });
    expect(r.next).toBeNull();
    expect(r.progress).toBe(1);
    expect(r.message).toMatch(/done/i);
  });
});
