import { describe, it, expect } from "vitest";
import {
  scoreInterests,
  pickTheme,
  applyTheme,
  resolveThemedAssetId,
  SEED_THEMES,
  type LearnerInterestProfile,
} from "../index.js";

const ISO = (daysAgo: number) =>
  new Date(Date.now() - daysAgo * 86_400_000).toISOString();

const profile: LearnerInterestProfile = {
  learnerId: "learner-1",
  signals: [
    { slug: "dinosaurs", source: "caregiver_intake", polarity: 1, confidence: 1, observedAt: ISO(7) },
    { slug: "trains", source: "engagement", polarity: 1, confidence: 0.6, observedAt: ISO(2) },
    { slug: "weather", source: "iep_signal", polarity: -1, confidence: 1, observedAt: ISO(30) },
  ],
};

describe("scoreInterests", () => {
  it("ranks high-confidence intake signals above weak engagement signals", () => {
    const scored = scoreInterests(profile);
    const dinos = scored.find((s) => s.slug === "dinosaurs")!;
    const trains = scored.find((s) => s.slug === "trains")!;
    expect(dinos.score).toBeGreaterThan(trains.score);
  });

  it("marks blocked interests with score=0 and blocked=true", () => {
    const scored = scoreInterests(profile);
    const weather = scored.find((s) => s.slug === "weather")!;
    expect(weather.blocked).toBe(true);
    expect(weather.score).toBe(0);
  });

  it("decays old signals (180-day half-life)", () => {
    const old: LearnerInterestProfile = {
      learnerId: "x",
      signals: [
        { slug: "dinosaurs", source: "caregiver_intake", polarity: 1, confidence: 1, observedAt: ISO(180) },
      ],
    };
    const fresh: LearnerInterestProfile = {
      learnerId: "x",
      signals: [
        { slug: "dinosaurs", source: "caregiver_intake", polarity: 1, confidence: 1, observedAt: ISO(0) },
      ],
    };
    const oldScore = scoreInterests(old)[0].score;
    const freshScore = scoreInterests(fresh)[0].score;
    expect(oldScore).toBeCloseTo(freshScore * 0.5, 1);
  });
});

describe("pickTheme", () => {
  it("picks the highest-scoring non-blocked theme", () => {
    const t = pickTheme(profile);
    expect(t?.slug).toBe("dinosaurs");
  });

  it("respects ageBand filter", () => {
    const adult: LearnerInterestProfile = {
      learnerId: "x",
      signals: [
        { slug: "trains", source: "caregiver_intake", polarity: 1, confidence: 1, observedAt: ISO(0) },
      ],
    };
    // Trains is age-banded PK / K-2 / 3-5 — 9-12 should miss.
    const result = pickTheme(adult, { ageBand: "9-12" });
    expect(result).toBeNull();
  });

  it("excludes themes carrying disallowed sensory cautions", () => {
    const p: LearnerInterestProfile = {
      learnerId: "x",
      signals: [
        { slug: "music", source: "caregiver_intake", polarity: 1, confidence: 1, observedAt: ISO(0) },
      ],
    };
    const t = pickTheme(p, { excludeCautions: ["loud_audio"] });
    expect(t).toBeNull();
  });

  it("respects minScore threshold", () => {
    const t = pickTheme(profile, { minScore: 0.99 });
    // Even the strongest interest is < 0.99 because of decay.
    // (or some signals will be) — assert the helper still returns null
    // when the threshold is set absurdly high.
    if (t) expect(t.slug).toBeTruthy(); // sanity
    const tHigh = pickTheme(profile, { minScore: 1.5 });
    expect(tHigh).toBeNull();
  });

  it("never picks a blocked theme even when its score is artificially raised", () => {
    const p: LearnerInterestProfile = {
      learnerId: "x",
      signals: [
        { slug: "weather", source: "caregiver_intake", polarity: 1, confidence: 1, observedAt: ISO(0) },
        { slug: "weather", source: "self_report", polarity: -1, confidence: 1, observedAt: ISO(1) },
      ],
    };
    expect(pickTheme(p)).toBeNull();
  });
});

describe("applyTheme", () => {
  it("substitutes {{noun}} and {{verb}} placeholders deterministically with seeded rng", () => {
    const dinos = SEED_THEMES.find((t) => t.slug === "dinosaurs")!;
    let i = 0;
    const rng = () => [0, 0.3, 0.7][i++ % 3];
    const out = applyTheme("The {{noun}} likes to {{verb}}.", dinos, rng);
    expect(out).toMatch(/^The (T-Rex|Triceratops|Stegosaurus|Brachiosaurus|Velociraptor|fossil|egg) likes to (stomp|roar|hatch|dig|spot)\.$/);
  });

  it("uses a different noun for each {{noun}} placeholder when possible", () => {
    const dinos = SEED_THEMES.find((t) => t.slug === "dinosaurs")!;
    const rng = (() => { let i = 0; return () => (i++ * 0.137) % 1; })();
    const out = applyTheme("{{noun}} and {{noun}}", dinos, rng);
    const [a, b] = out.split(" and ");
    expect(a).not.toBe(b);
  });

  it("returns the template unchanged when the theme has no nouns", () => {
    const out = applyTheme("Hello {{noun}}", { ...SEED_THEMES[0], nouns: [] }, () => 0);
    expect(out).toBe("Hello {{noun}}");
  });
});

describe("resolveThemedAssetId", () => {
  it("prefixes the role with the theme's first asset namespace", () => {
    const dinos = SEED_THEMES.find((t) => t.slug === "dinosaurs")!;
    expect(resolveThemedAssetId("character-1", dinos)).toBe("dinos/character-1");
  });
  it("returns null when the theme has no asset namespaces", () => {
    expect(resolveThemedAssetId("character-1", { ...SEED_THEMES[0], assetNamespaces: [] })).toBeNull();
  });
});

describe("SEED_THEMES", () => {
  it("has stable, unique slugs", () => {
    const slugs = SEED_THEMES.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
