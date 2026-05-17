import { describe, expect, it } from "vitest";
import { analyzeGeometryWork } from "../services/geometry-work-analyzer.js";

describe("analyzeGeometryWork", () => {
  it("flags perimeter-formula misconception when area was requested", () => {
    const result = analyzeGeometryWork({
      prompt: "Find the area of the rectangle.",
      typedWork: "2 * (8 + 4)",
      finalAnswer: 24,
    });
    const codes = result.misconceptions.map((m) => m.id);
    expect(codes).toContain("perimeter_instead_of_area");
  });

  it("flags area-formula misconception when perimeter was requested", () => {
    const result = analyzeGeometryWork({
      prompt: "Find the perimeter of the rectangle.",
      typedWork: "8 * 4",
      finalAnswer: 32,
    });
    const codes = result.misconceptions.map((m) => m.id);
    expect(codes).toContain("area_instead_of_perimeter");
  });

  it("flags missing unit on an area answer", () => {
    const result = analyzeGeometryWork({
      prompt: "Find the area of the rectangle.",
      typedWork: "8 * 4",
      finalAnswer: 32,
    });
    const codes = result.misconceptions.map((m) => m.id);
    expect(codes).toContain("missing_unit");
  });

  it("does not flag missing unit when unit is present", () => {
    const result = analyzeGeometryWork({
      prompt: "Find the area of the rectangle.",
      typedWork: "8 * 4 cm^2",
      finalAnswer: 32,
    });
    const codes = result.misconceptions.map((m) => m.id);
    expect(codes).not.toContain("missing_unit");
  });

  it("flags diameter-for-radius confusion", () => {
    const result = analyzeGeometryWork({
      prompt: "Find the radius of the circle.",
      typedWork: "diameter is 10",
    });
    const codes = result.misconceptions.map((m) => m.id);
    expect(codes).toContain("diameter_for_radius");
  });

  it("returns no misconceptions for a clean area solve", () => {
    const result = analyzeGeometryWork({
      prompt: "Find the area of the rectangle.",
      typedWork: "area = 8 * 4 cm^2",
      finalAnswer: 32,
    });
    expect(result.misconceptions).toEqual([]);
  });
});
