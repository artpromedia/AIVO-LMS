import { afterEach, describe, expect, it } from "vitest";
import {
  detectPii,
  resetPiiJudge,
  setPiiJudge,
} from "../../src/detectors/pii.js";

afterEach(() => resetPiiJudge());

describe("detectPii", () => {
  it("blocks on SSN", async () => {
    const r = await detectPii({ text: "My SSN is 123-45-6789." });
    expect(r.verdict).toBe("block");
    expect(r.evidence.some((e) => e.code === "pii.ssn")).toBe(true);
  });

  it("blocks on phone + email", async () => {
    const r = await detectPii({
      text: "Call me at (415) 555-1212 or alice@example.com.",
    });
    expect(r.verdict).toBe("block");
    const codes = r.evidence.map((e) => e.code);
    expect(codes).toContain("pii.phone");
    expect(codes).toContain("pii.email");
  });

  it("blocks on IEP goal id and diagnostic code", async () => {
    const r = await detectPii({
      text: "Refer to IEP-GOAL-1234 and diagnosis F90.0 in the report.",
    });
    expect(r.verdict).toBe("block");
    expect(r.evidence.map((e) => e.code)).toEqual(
      expect.arrayContaining(["iep.goal_id", "iep.diagnostic_code"]),
    );
  });

  it("allows benign learner text", async () => {
    const r = await detectPii({ text: "I love solving math word problems." });
    expect(r.verdict).toBe("allow");
  });

  it("fails to 'review' with errored=true when the judge throws", async () => {
    setPiiJudge(async () => {
      throw new Error("judge timeout");
    });
    const r = await detectPii({ text: "innocent text" });
    expect(r.errored).toBe(true);
    expect(r.verdict).toBe("review");
  });

  it("masks span instead of returning raw token", async () => {
    const r = await detectPii({ text: "My ssn is 123-45-6789 thanks." });
    const ssn = r.evidence.find((e) => e.code === "pii.ssn");
    expect(ssn?.evidence).toBeDefined();
    expect(ssn?.evidence).not.toContain("123-45-6789");
  });
});
