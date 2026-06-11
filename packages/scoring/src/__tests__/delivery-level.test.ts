import { describe, expect, it } from "vitest";
import {
  GRADE_BANDS,
  canonicalSubjectKey,
  deliveryLevelFromTheta,
  deliveryLevelsFromThetas,
  gradeBandIndex,
  normalizeGradeBand,
} from "../delivery-level.js";

describe("normalizeGradeBand", () => {
  it("accepts canonical bands", () => {
    for (const band of GRADE_BANDS) {
      expect(normalizeGradeBand(band)).toBe(band);
    }
  });

  it("normalizes kindergarten variants", () => {
    for (const v of ["k", "K", "0", "kindergarten", "Kindergarten", "pre-k", "prek"]) {
      expect(normalizeGradeBand(v)).toBe("K");
    }
  });

  it("normalizes numeric, prefixed, ordinal-suffixed and word forms", () => {
    expect(normalizeGradeBand("3")).toBe("3");
    expect(normalizeGradeBand("Grade 3")).toBe("3");
    expect(normalizeGradeBand("grade 12")).toBe("12");
    expect(normalizeGradeBand("Year 4")).toBe("4");
    expect(normalizeGradeBand("g3")).toBe("3");
    expect(normalizeGradeBand("3rd")).toBe("3");
    expect(normalizeGradeBand("1st")).toBe("1");
    expect(normalizeGradeBand("THIRD")).toBe("3");
    expect(normalizeGradeBand("fifth")).toBe("5");
    expect(normalizeGradeBand("Twelfth")).toBe("12");
  });

  it("returns null for unparseable input — never a default", () => {
    for (const v of [null, undefined, "", "  ", "n/a", "elementary", "13", "grade 13", "abc"]) {
      expect(normalizeGradeBand(v)).toBeNull();
    }
  });
});

describe("deliveryLevelFromTheta", () => {
  it("places on grade at θ ≥ 0.4", () => {
    expect(deliveryLevelFromTheta(0.4, "5")).toBe("5");
    expect(deliveryLevelFromTheta(2.0, "5")).toBe("5");
  });

  it("places one band below for -0.3 ≤ θ < 0.4", () => {
    expect(deliveryLevelFromTheta(0.39, "5")).toBe("4");
    expect(deliveryLevelFromTheta(0.0, "5")).toBe("4");
    expect(deliveryLevelFromTheta(-0.3, "5")).toBe("4");
  });

  it("places two bands below for -1.0 ≤ θ < -0.3", () => {
    expect(deliveryLevelFromTheta(-0.31, "5")).toBe("3");
    expect(deliveryLevelFromTheta(-0.5, "5")).toBe("3");
    expect(deliveryLevelFromTheta(-1.0, "5")).toBe("3");
  });

  it("places three bands below for θ < -1.0", () => {
    expect(deliveryLevelFromTheta(-1.01, "5")).toBe("2");
    expect(deliveryLevelFromTheta(-3.0, "5")).toBe("2");
  });

  it("clamps at K for early grades", () => {
    expect(deliveryLevelFromTheta(-3.0, "2")).toBe("K");
    expect(deliveryLevelFromTheta(-3.0, "K")).toBe("K");
    expect(deliveryLevelFromTheta(-0.5, "1")).toBe("K");
  });

  it("never exceeds the enrolled grade", () => {
    expect(deliveryLevelFromTheta(5.0, "K")).toBe("K");
    expect(deliveryLevelFromTheta(5.0, "12")).toBe("12");
  });

  it("throws on non-finite theta (caller bug, no silent placement)", () => {
    expect(() => deliveryLevelFromTheta(Number.NaN, "5")).toThrow(/finite/);
    expect(() => deliveryLevelFromTheta(Number.POSITIVE_INFINITY, "5")).toThrow(/finite/);
    expect(() => deliveryLevelFromTheta(Number.NEGATIVE_INFINITY, "5")).toThrow(/finite/);
  });
});

describe("gradeBandIndex", () => {
  it("orders K before 1 before 12", () => {
    expect(gradeBandIndex("K")).toBe(0);
    expect(gradeBandIndex("1")).toBe(1);
    expect(gradeBandIndex("12")).toBe(12);
  });
});

describe("canonicalSubjectKey (Wave C, G1)", () => {
  it("maps every producer vocabulary onto one canonical key", () => {
    // brand tutor domains (learning-svc sessions)
    expect(canonicalSubjectKey("Mathematics")).toBe("math");
    expect(canonicalSubjectKey("English Language Arts")).toBe("reading");
    expect(canonicalSubjectKey("Speech & Language Therapy")).toBe("speech");
    expect(canonicalSubjectKey("Life Skills & Executive Function")).toBe("life-skills");
    // ai-svc chapter domains (discovery baseline)
    expect(canonicalSubjectKey("ela")).toBe("reading");
    expect(canonicalSubjectKey("sel")).toBe("social");
    expect(canonicalSubjectKey("executive_function")).toBe("executive-function");
    expect(canonicalSubjectKey("life_skills")).toBe("life-skills");
    // web subject slugs
    expect(canonicalSubjectKey("math")).toBe("math");
    expect(canonicalSubjectKey("reading")).toBe("reading");
    expect(canonicalSubjectKey("social-studies")).toBe("social-studies");
  });

  it("slugifies unknown subjects deterministically and rejects empties", () => {
    expect(canonicalSubjectKey("Marine Biology 101")).toBe("marine-biology-101");
    expect(canonicalSubjectKey("  ")).toBeNull();
    expect(canonicalSubjectKey(null)).toBeNull();
    expect(canonicalSubjectKey(undefined)).toBeNull();
  });
});

describe("deliveryLevelsFromThetas (Wave C, G1)", () => {
  it("maps per-subject thetas to per-subject bands with canonical keys", () => {
    const out = deliveryLevelsFromThetas({ Mathematics: -0.8, ela: 0.5 }, "5");
    expect(out).toEqual({ math: "3", reading: "5" });
  });

  it("skips non-finite thetas without losing the other subjects", () => {
    const out = deliveryLevelsFromThetas({ math: Number.NaN, reading: 0.5 }, "4");
    expect(out).toEqual({ reading: "4" });
  });

  it("clamps every subject to [K, enrolled]", () => {
    const out = deliveryLevelsFromThetas({ math: -9, reading: 9 }, "1");
    expect(out).toEqual({ math: "K", reading: "1" });
  });
});
