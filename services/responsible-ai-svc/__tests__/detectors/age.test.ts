import { afterEach, describe, expect, it } from "vitest";
import {
  detectAgeAppropriateness,
  resetAgeBandResolver,
  setAgeBandResolver,
} from "../../src/detectors/age.js";

afterEach(() => resetAgeBandResolver());

describe("detectAgeAppropriateness", () => {
  it("blocks graphic violence for k_2", async () => {
    const r = await detectAgeAppropriateness({
      text: "The villain commits graphic violence on the hero.",
      ageBand: "k_2",
    });
    expect(r.verdict).toBe("block");
    expect(r.evidence.map((e) => e.code)).toContain("age.graphic_violence");
  });

  it("blocks romance/dating for k_2 and 3_5", async () => {
    const r = await detectAgeAppropriateness({
      text: "She wants a romantic partner and a kiss me note.",
      ageBand: "3_5",
    });
    expect(r.verdict).toBe("block");
    expect(r.evidence.map((e) => e.code)).toContain("age.romance_dating");
  });

  it("allows romance for 9_12", async () => {
    const r = await detectAgeAppropriateness({
      text: "She wants a kiss me note from her boyfriend.",
      ageBand: "9_12",
    });
    expect(r.verdict).toBe("allow");
  });

  it("blocks substance content even at 6_8", async () => {
    const r = await detectAgeAppropriateness({
      text: "He smelled the beer and felt sick.",
      ageBand: "6_8",
    });
    expect(r.verdict).toBe("block");
    expect(r.evidence.map((e) => e.code)).toContain("age.substance");
  });

  it("allows benign math text", async () => {
    const r = await detectAgeAppropriateness({
      text: "Let's solve 8 + 7.",
      ageBand: "k_2",
    });
    expect(r.verdict).toBe("allow");
  });

  it("uses resolver when ageBand not in context", async () => {
    setAgeBandResolver(async () => "k_2");
    const r = await detectAgeAppropriateness({
      text: "Graphic violence on screen.",
      learnerId: "learner-1",
    });
    expect(r.verdict).toBe("block");
  });

  it("defaults to most restrictive when resolver returns null", async () => {
    setAgeBandResolver(async () => null);
    const r = await detectAgeAppropriateness({
      text: "Romantic partner dating scene.",
      learnerId: "learner-2",
    });
    expect(r.verdict).toBe("block");
  });

  it("returns errored + review when resolver throws", async () => {
    setAgeBandResolver(async () => {
      throw new Error("family-svc down");
    });
    const r = await detectAgeAppropriateness({
      text: "innocent text",
      learnerId: "learner-3",
    });
    expect(r.errored).toBe(true);
    expect(r.verdict).toBe("review");
  });
});
