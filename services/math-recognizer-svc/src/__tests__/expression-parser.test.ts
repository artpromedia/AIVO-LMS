import { describe, expect, it } from "vitest";
import { detectArithmeticMismatch, parseMathExpression } from "../services/expression-parser.js";

describe("parseMathExpression", () => {
  it("normalizes 'x' multiplication into '*'", () => {
    const parsed = parseMathExpression("8 x 4");
    expect(parsed.normalized).toBe("8 * 4");
    expect(parsed.numbers).toEqual([8, 4]);
    expect(parsed.detectedFormula).toBe("area_rectangle");
  });

  it("detects area when prompt-style text exists", () => {
    const parsed = parseMathExpression("area = 8 * 4");
    expect(parsed.detectedFormula).toBe("area_rectangle");
    expect(parsed.operators).toContain("*");
  });

  it("detects perimeter formula", () => {
    const parsed = parseMathExpression("2 * (8 + 4)");
    expect(parsed.detectedFormula).toBe("perimeter_rectangle");
  });

  it("detects repeated addition", () => {
    const parsed = parseMathExpression("8 + 8 + 8 + 8");
    expect(parsed.detectedFormula).toBe("repeated_addition");
    expect(parsed.numbers).toEqual([8, 8, 8, 8]);
  });

  it("detects squared units", () => {
    const parsed = parseMathExpression("32 cm^2");
    expect(parsed.hasUnit).toBe(true);
    expect(parsed.detectedUnit).toBe("cm^2");
  });

  it("returns no unit when not present", () => {
    expect(parseMathExpression("32").hasUnit).toBe(false);
  });
});

describe("detectArithmeticMismatch", () => {
  it("returns true when shown work multiplies to a different value", () => {
    expect(detectArithmeticMismatch("8 * 4", 30)).toBe(true);
  });

  it("returns false when shown work matches the final answer", () => {
    expect(detectArithmeticMismatch("8 * 4", 32)).toBe(false);
  });

  it("returns false when final answer is missing", () => {
    expect(detectArithmeticMismatch("8 * 4", undefined)).toBe(false);
  });

  it("returns true when repeated addition does not sum to the final answer", () => {
    expect(detectArithmeticMismatch("8 + 8 + 8 + 8", 30)).toBe(true);
  });
});
