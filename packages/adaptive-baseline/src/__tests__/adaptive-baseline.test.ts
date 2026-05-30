import { describe, it, expect } from "vitest";
import {
  initBaseline,
  pickNextItem,
  recordResponse,
  shouldStop,
  buildLearningProfile,
  finalize,
  assessFrustration,
  FRUSTRATION_CEILING,
  itemProbability,
  itemInformation,
  pickNextItem as pick2,
  type BaselineItem,
  type BaselineState,
} from "../index.js";

const bank: BaselineItem[] = [
  {
    id: "i1",
    skillId: "math.add.k",
    difficulty: -1.0,
    modalities: ["visual"],
    lightReading: true,
    gradeBand: "K",
  },
  {
    id: "i2",
    skillId: "math.add.k",
    difficulty: -0.5,
    modalities: ["visual", "auditory"],
    lightReading: true,
    gradeBand: "K",
  },
  {
    id: "i3",
    skillId: "math.add.1",
    difficulty: 0,
    modalities: ["reading"],
    lightReading: false,
    gradeBand: "1",
  },
  {
    id: "i4",
    skillId: "math.sub.1",
    difficulty: 0.5,
    modalities: ["visual"],
    lightReading: true,
    gradeBand: "1",
  },
  {
    id: "i5",
    skillId: "math.sub.2",
    difficulty: 1.0,
    modalities: ["reading"],
    lightReading: false,
    gradeBand: "2",
  },
  {
    id: "i6",
    skillId: "math.mul.2",
    difficulty: 1.5,
    modalities: ["auditory"],
    lightReading: true,
    gradeBand: "2",
  },
  {
    id: "i7",
    skillId: "math.mul.3",
    difficulty: 2.0,
    modalities: ["kinesthetic"],
    lightReading: true,
    gradeBand: "3",
  },
  {
    id: "i8",
    skillId: "ela.read.k",
    difficulty: -0.7,
    modalities: ["auditory"],
    lightReading: true,
    gradeBand: "K",
  },
];

describe("adaptive-baseline", () => {
  it("picks an item closest to θ=0 first", () => {
    const s = initBaseline();
    const pick = pickNextItem(s, bank);
    expect(pick).not.toBeNull();
    // i3 (diff=0) is the closest to θ=0.
    expect(pick!.id).toBe("i3");
  });

  it("prefers light-reading items when readingDifficulty=true within tie band", () => {
    const s = initBaseline({ readingDifficulty: true });
    const pick = pickNextItem(s, bank);
    // i3 has diff 0 but lightReading=false → +0.5 penalty → loses to i2 (gap 0.5, lightReading)
    expect(pick!.lightReading).toBe(true);
  });

  it("does not re-administer the same item", () => {
    let s = initBaseline();
    const first = pickNextItem(s, bank)!;
    s = recordResponse({
      state: s,
      item: first,
      response: { itemId: first.id, correct: true, responseTimeMs: 1500 },
    });
    const second = pickNextItem(s, bank)!;
    expect(second.id).not.toBe(first.id);
  });

  it("moves θ up after a correct answer and down after a wrong one", () => {
    let s = initBaseline();
    const it = bank.find((b) => b.id === "i3")!;
    const sUp = recordResponse({
      state: s,
      item: it,
      response: { itemId: it.id, correct: true, responseTimeMs: 1500 },
    });
    expect(sUp.theta).toBeGreaterThan(0);
    const sDown = recordResponse({
      state: s,
      item: it,
      response: { itemId: it.id, correct: false, responseTimeMs: 1500 },
    });
    expect(sDown.theta).toBeLessThan(0);
  });

  it("does not stop before MIN_ITEMS even if SE is low", () => {
    let s = initBaseline();
    // Force info high by seeding administered.
    s = { ...s, infoSum: 999 };
    expect(shouldStop(s).stop).toBe(false);
    expect(shouldStop(s).reason).toBe("min_items_pending");
  });

  it("stops at MAX_ITEMS even if SE never converges", () => {
    let s = initBaseline();
    for (let i = 0; i < 20; i++) {
      s = {
        ...s,
        administered: [...s.administered, { itemId: `x${i}`, correct: true, responseTimeMs: 1000 }],
      };
    }
    expect(shouldStop(s).stop).toBe(true);
    expect(shouldStop(s).reason).toBe("max_items");
  });

  it("stops once SE ≤ 0.35 after MIN_ITEMS", () => {
    let s = initBaseline();
    for (let i = 0; i < 6; i++) {
      s = {
        ...s,
        administered: [...s.administered, { itemId: `x${i}`, correct: true, responseTimeMs: 1000 }],
      };
    }
    s = { ...s, infoSum: 10 };
    const d = shouldStop(s);
    expect(d.stop).toBe(true);
    expect(d.reason).toBe("se_below_threshold");
  });

  it("computes modality fit ordered best→worst", () => {
    let s = initBaseline();
    // visual: 2/2 correct; reading: 0/1.
    s = recordResponse({
      state: s,
      item: bank[0],
      response: { itemId: "i1", correct: true, responseTimeMs: 800, consumedModality: "visual" },
    });
    s = recordResponse({
      state: s,
      item: bank[3],
      response: { itemId: "i4", correct: true, responseTimeMs: 1200, consumedModality: "visual" },
    });
    s = recordResponse({
      state: s,
      item: bank[2],
      response: { itemId: "i3", correct: false, responseTimeMs: 4000, consumedModality: "reading" },
    });
    const p = buildLearningProfile(s, bank);
    expect(p.modalityFit[0].modality).toBe("visual");
    expect(p.modalityFit[0].accuracy).toBe(1);
    const reading = p.modalityFit.find((m) => m.modality === "reading");
    expect(reading?.accuracy).toBe(0);
  });

  it("flags low frustration tolerance when ≥40% of items show frustration", () => {
    let s = initBaseline();
    for (let i = 0; i < 5; i++) {
      s = recordResponse({
        state: s,
        item: bank[i],
        response: {
          itemId: bank[i].id,
          correct: i % 2 === 0,
          responseTimeMs: 2000,
          affect: i < 3 ? ["frustration"] : undefined,
        },
      });
    }
    const p = buildLearningProfile(s, bank);
    expect(p.frustrationRate).toBeCloseTo(0.6, 5);
    expect(p.frustrationTolerance).toBe("low");
    // First frustration was on item 0 → run length 0.
    expect(p.attentionRunLength).toBe(0);
  });

  it("uses median (not mean) for processingSpeedMs", () => {
    let s = initBaseline();
    const times = [500, 800, 1500, 9000, 1100];
    for (let i = 0; i < times.length; i++) {
      s = recordResponse({
        state: s,
        item: bank[i],
        response: { itemId: bank[i].id, correct: true, responseTimeMs: times[i] },
      });
    }
    const p = buildLearningProfile(s, bank);
    expect(p.processingSpeedMs).toBe(1100);
  });

  it("finalize returns placement + profile", () => {
    let s = initBaseline();
    s = recordResponse({
      state: s,
      item: bank[0],
      response: { itemId: "i1", correct: true, responseTimeMs: 1000 },
    });
    const r = finalize(s, bank);
    expect(r.itemsAdministered).toBe(1);
    expect(r.finalTheta).toBeCloseTo(s.theta, 5);
    expect(r.profile.thetaPlacement).toBe(Math.round(s.theta * 10) / 10);
  });

  it("throws if response.itemId mismatches item.id", () => {
    const s = initBaseline();
    expect(() =>
      recordResponse({
        state: s,
        item: bank[0],
        response: { itemId: "wrong", correct: true, responseTimeMs: 100 },
      }),
    ).toThrow(/itemId mismatch/);
  });
});

describe("2-PL discrimination", () => {
  function item(id: string, b: number, a?: number): BaselineItem {
    return {
      id,
      skillId: id,
      difficulty: b,
      modalities: ["reading"],
      lightReading: false,
      ...(a !== undefined ? { discrimination: a } : {}),
    };
  }

  it("collapses to 1-PL when discrimination is omitted (a=1)", () => {
    const it1 = item("x", 0.5);
    expect(itemProbability(0, it1)).toBeCloseTo(1 / (1 + Math.exp(0.5)), 10);
    expect(itemInformation(0.5, it1)).toBeCloseTo(0.25, 10); // p=.5 → a²·.25 = .25
  });

  it("a higher discrimination yields a steeper curve + more information at b", () => {
    const low = item("l", 0, 0.5);
    const high = item("h", 0, 2.0);
    // At θ=b both are p=.5, but Fisher info scales with a².
    expect(itemInformation(0, high)).toBeCloseTo(2.0 * 2.0 * 0.25, 10);
    expect(itemInformation(0, low)).toBeCloseTo(0.5 * 0.5 * 0.25, 10);
    expect(itemInformation(0, high)).toBeGreaterThan(itemInformation(0, low));
    // Away from b, the high-a item is more confidently scored.
    expect(itemProbability(1, high)).toBeGreaterThan(itemProbability(1, low));
  });

  it("a high-discrimination answer moves θ more and adds more info", () => {
    const base = initBaseline();
    const lowA = recordResponse({
      state: base,
      item: item("l", 0, 0.5),
      response: { itemId: "l", correct: true, responseTimeMs: 100 },
    });
    const highA = recordResponse({
      state: base,
      item: item("h", 0, 2.0),
      response: { itemId: "h", correct: true, responseTimeMs: 100 },
    });
    expect(highA.theta).toBeGreaterThan(lowA.theta);
    expect(highA.infoSum).toBeGreaterThan(lowA.infoSum);
  });

  it("a=1 reproduces the exact legacy 1-PL θ update", () => {
    const s = initBaseline();
    const next = recordResponse({
      state: s,
      item: item("x", 0.0),
      response: { itemId: "x", correct: true, responseTimeMs: 100 },
    });
    // Legacy: p=sigmoid(0-0)=.5, θ = 0 + 0.4*(1-.5) = 0.2.
    expect(next.theta).toBeCloseTo(0.2, 10);
  });

  it("prefers the more discriminating item among equal-difficulty candidates", () => {
    const s = initBaseline(); // θ=0
    const bankD: BaselineItem[] = [item("plain", 0.0, 1.0), item("sharp", 0.0, 2.0)];
    expect(pick2(s, bankD)?.id).toBe("sharp");
  });

  it("reaches the SE stop sooner with high-discrimination items", () => {
    const hi = item("a", 0, 2.5);
    const lo = item("b", 0, 0.6);
    let sHi = initBaseline();
    let sLo = initBaseline();
    for (let i = 0; i < 6; i++) {
      sHi = recordResponse({ state: sHi, item: hi, response: { itemId: "a", correct: i % 2 === 0, responseTimeMs: 1 } });
      sLo = recordResponse({ state: sLo, item: lo, response: { itemId: "b", correct: i % 2 === 0, responseTimeMs: 1 } });
    }
    // More info accumulated ⇒ smaller SE.
    expect(shouldStop(sHi).se).toBeLessThan(shouldStop(sLo).se);
  });
});

describe("frustration ceiling (G5 parity)", () => {
  function stateWith(theta: number, trailing: boolean[]): BaselineState {
    return {
      theta,
      infoSum: 0,
      administered: trailing.map((correct, i) => ({
        itemId: `done${i}`,
        correct,
        responseTimeMs: 100,
      })),
      coveredSkills: new Set<string>(),
      readingDifficulty: false,
    };
  }

  it("escalates the level/ceiling with a trailing wrong run", () => {
    expect(assessFrustration(stateWith(0, [true, true])).level).toBe("none");
    expect(assessFrustration(stateWith(0, [true, false, false])).level).toBe("mild");
    const high = assessFrustration(stateWith(0, [false, false, false]));
    expect(high.level).toBe("high");
    expect(high.ceiling).toBeLessThan(FRUSTRATION_CEILING);
  });

  it("counts affect signals as struggle", () => {
    const s: BaselineState = {
      theta: 0,
      infoSum: 0,
      administered: [
        { itemId: "a", correct: true, responseTimeMs: 100, affect: ["frustration"] },
        { itemId: "b", correct: true, responseTimeMs: 100, affect: ["disengagement"] },
      ],
      coveredSkills: new Set<string>(),
      readingDifficulty: false,
    };
    expect(assessFrustration(s).level).toBe("mild");
  });

  it("undershoots: a struggling learner gets an easier item under the ceiling", () => {
    const pool: BaselineItem[] = [
      { id: "hard", skillId: "s1", difficulty: 0.4, modalities: ["reading"], lightReading: false },
      { id: "easy", skillId: "s2", difficulty: -0.8, modalities: ["reading"], lightReading: false },
    ];
    // θ=0, three trailing wrong → high → ceiling 0.25 → cap 0.25 excludes
    // the (nearer) hard item, so the easier one is served.
    const struggling = stateWith(0, [false, false, false]);
    const withCeiling = pickNextItem(struggling, pool, { applyFrustrationCeiling: true });
    expect(withCeiling?.id).toBe("easy");
    // Without the flag, the nearest (hard) item wins.
    const calm = stateWith(0, []);
    expect(pickNextItem(calm, pool)?.id).toBe("hard");
  });
});
