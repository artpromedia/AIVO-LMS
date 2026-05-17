import { describe, it, expect } from "vitest";
import {
  scaffold,
  retrieve,
  schedule,
  initialMasteryRecord,
  correctError,
  type AnswerOutcome,
  type MasteryRecord,
} from "../index.js";

const at = (mins: number) =>
  new Date(Date.now() - mins * 60_000).toISOString();

const wrong = (skillId: string): AnswerOutcome => ({
  skillId,
  correct: false,
  recordedAt: at(0),
  firstAttempt: true,
});
const right = (skillId: string): AnswerOutcome => ({
  skillId,
  correct: true,
  recordedAt: at(0),
  firstAttempt: true,
});

describe("scaffold", () => {
  it("none → none with no history", () => {
    const d = scaffold({ recent: [] });
    expect(d.level).toBe("none");
  });
  it("escalates hint → model → simplify on consecutive wrongs", () => {
    expect(scaffold({ recent: [wrong("s")] }).level).toBe("hint");
    expect(scaffold({ recent: [wrong("s"), wrong("s")] }).level).toBe("model");
    expect(scaffold({ recent: [wrong("s"), wrong("s"), wrong("s")] }).level).toBe("simplify");
  });
  it("fades one step on a correct answer", () => {
    const d = scaffold({ recent: [wrong("s"), wrong("s"), right("s")], current: "model" });
    expect(d.level).toBe("hint");
  });
});

describe("retrieve", () => {
  const records: MasteryRecord[] = [
    {
      skillId: "fresh",
      mastery: 0.8,
      easeFactor: 2.5,
      streak: 1,
      reps: 2,
      intervalDays: 6,
      lastReviewedAt: at(60), // 1h ago
      dueAt: at(-60 * 24 * 6),
    },
    {
      skillId: "stale",
      mastery: 0.85,
      easeFactor: 2.5,
      streak: 1,
      reps: 3,
      intervalDays: 14,
      lastReviewedAt: at(60 * 24 * 30), // 30d ago
      dueAt: at(-60 * 24 * 14),
    },
    {
      skillId: "weak",
      mastery: 0.3,
      easeFactor: 2.0,
      streak: 0,
      reps: 1,
      intervalDays: 1,
      lastReviewedAt: at(0),
      dueAt: at(-60 * 24),
    },
  ];

  it("filters out skills below minMastery (default 0.5)", () => {
    const d = retrieve({ catalog: records, recentlyCovered: [] });
    expect(d.candidates.find((c) => c.skillId === "weak")).toBeUndefined();
  });

  it("orders weakest-retrieval-strength first (forgetting risk)", () => {
    const d = retrieve({ catalog: records, recentlyCovered: [] });
    // The 30-day-old skill has decayed more than the 1-hour-old skill.
    expect(d.candidates[0].skillId).toBe("stale");
  });

  it("excludes recently-covered skills", () => {
    const d = retrieve({ catalog: records, recentlyCovered: ["stale"] });
    expect(d.candidates.find((c) => c.skillId === "stale")).toBeUndefined();
  });
});

describe("schedule (SM-2)", () => {
  it("first correct response: reps=1, interval=1d", () => {
    const cur = initialMasteryRecord("s");
    const d = schedule({ current: cur, outcome: right("s") });
    expect(d.next.reps).toBe(1);
    expect(d.next.intervalDays).toBe(1);
    expect(d.quality).toBe(4); // correct, no hints, no fast-latency signal
  });

  it("second correct response: reps=2, interval=6d", () => {
    let r = initialMasteryRecord("s");
    r = schedule({ current: r, outcome: right("s") }).next;
    const d = schedule({ current: r, outcome: right("s") });
    expect(d.next.reps).toBe(2);
    expect(d.next.intervalDays).toBe(6);
  });

  it("incorrect resets reps to 0 and interval to 1d", () => {
    let r = initialMasteryRecord("s");
    r = schedule({ current: r, outcome: right("s") }).next;
    r = schedule({ current: r, outcome: right("s") }).next;
    const d = schedule({ current: r, outcome: wrong("s") });
    expect(d.next.reps).toBe(0);
    expect(d.next.intervalDays).toBe(1);
    expect(d.quality).toBeLessThan(3);
  });

  it("fast latency upgrades quality to 5", () => {
    const cur = initialMasteryRecord("s");
    const d = schedule({
      current: cur,
      outcome: { ...right("s"), latencyMs: 1500 },
    });
    expect(d.quality).toBe(5);
  });

  it("hint usage downgrades quality to 3", () => {
    const cur = initialMasteryRecord("s");
    const d = schedule({
      current: cur,
      outcome: { ...right("s"), hintsUsed: 1 },
    });
    expect(d.quality).toBe(3);
  });

  it("ease factor stays ≥ 1.3", () => {
    let r: MasteryRecord = { ...initialMasteryRecord("s"), easeFactor: 1.3 };
    for (let i = 0; i < 5; i++) {
      r = schedule({ current: r, outcome: wrong("s") }).next;
    }
    expect(r.easeFactor).toBeGreaterThanOrEqual(1.3);
  });
});

describe("correctError", () => {
  it("classifies sub-second wrong answer as guess", () => {
    const d = correctError({ expected: "twelve", actual: "five", latencyMs: 500 });
    expect(d.category).toBe("guess");
    expect(d.recommendation).toBe("reteach");
  });
  it("classifies high-similarity wrong as near_miss → reinforce", () => {
    const d = correctError({ expected: "twelve", actual: "twele", latencyMs: 4000 });
    expect(d.category).toBe("near_miss");
    expect(d.recommendation).toBe("reinforce");
  });
  it("classifies wrong-family pick as category_error → differentiate", () => {
    const d = correctError({
      expected: "rectangle",
      actual: "blue",
      latencyMs: 2500,
      expectedFamily: "shape",
      distractorMeta: [
        { value: "blue", family: "color" },
        { value: "circle", family: "shape" },
      ],
    });
    expect(d.category).toBe("category_error");
    expect(d.recommendation).toBe("differentiate");
  });
  it("classifies materially-short answer as process_error", () => {
    const d = correctError({ expected: "twenty-four", actual: "tw", latencyMs: 2000 });
    expect(d.category).toBe("process_error");
  });
});
