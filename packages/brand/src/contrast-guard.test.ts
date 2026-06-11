import { describe, it, expect } from "vitest";
import {
  contrastRatio,
  evaluateBrandPalette,
  shadeHex,
  CONTRAST_AA_NORMAL,
  GUARD_SURFACES,
} from "./contrast-guard.js";
import { SEMANTIC } from "./tokens.js";

describe("contrastRatio", () => {
  it("matches the canonical black/white extremes", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 1);
    expect(contrastRatio("#FFFFFF", "#FFFFFF")).toBeCloseTo(1, 5);
  });
  it("is symmetric and supports shorthand hex", () => {
    expect(contrastRatio("#36c", "#ffffff")).toBeCloseTo(contrastRatio("#ffffff", "#3366cc")!, 5);
  });
  it("returns null for garbage", () => {
    expect(contrastRatio("purple", "#fff")).toBeNull();
  });
});

describe("evaluateBrandPalette", () => {
  it("the shipped AIVO primary passes every check (guard cannot reject the default)", () => {
    const verdict = evaluateBrandPalette({ primaryColor: SEMANTIC.color.interactive.primary });
    expect(verdict.failures).toEqual([]);
    expect(verdict.ok).toBe(true);
    expect(verdict.checks).toHaveLength(4);
  });

  it("a mid-band teal + orange pass all four checks", () => {
    const verdict = evaluateBrandPalette({ primaryColor: "#0F766E", secondaryColor: "#C2410C" });
    expect(verdict.ok).toBe(true);
    expect(verdict.checks).toHaveLength(8);
  });

  it("a navy passes light surfaces but fails ONLY the dark-chrome check", () => {
    const verdict = evaluateBrandPalette({ primaryColor: "#1D4ED8" });
    expect(verdict.ok).toBe(false);
    expect(verdict.failures.map((f) => f.context)).toEqual(["on dark chrome"]);
  });

  it("a pale yellow fails the light surfaces with a specific, actionable message", () => {
    const verdict = evaluateBrandPalette({ primaryColor: "#FFEB3B" });
    expect(verdict.ok).toBe(false);
    const onLight = verdict.failures.find((f) => f.context === "on light surface");
    expect(onLight).toBeDefined();
    expect(onLight!.required).toBe(CONTRAST_AA_NORMAL);
    expect(onLight!.message).toMatch(/^primary on light surface fails: \d+\.\d{2}:1 \(needs 4\.5:1\)$/);
  });

  it("near-black fails the dark-chrome check, not the light ones", () => {
    const verdict = evaluateBrandPalette({ primaryColor: "#111111" });
    const contexts = verdict.failures.map((f) => f.context);
    expect(contexts).toContain("on dark chrome");
    expect(contexts).not.toContain("on light surface");
  });

  it("secondary is optional but validated when present", () => {
    expect(evaluateBrandPalette({ primaryColor: "#0F766E" }).ok).toBe(true);
    const bad = evaluateBrandPalette({ primaryColor: "#0F766E", secondaryColor: "#FFFF00" });
    expect(bad.ok).toBe(false);
    expect(bad.failures.every((f) => f.slot === "secondary")).toBe(true);
  });

  it("rejects non-hex input loudly instead of guessing", () => {
    const verdict = evaluateBrandPalette({ primaryColor: "rebeccapurple" });
    expect(verdict.ok).toBe(false);
    expect(verdict.failures[0].message).toContain("hex color");
  });

  it("guard surfaces stay wired to the live tokens (refactor tripwire)", () => {
    expect(GUARD_SURFACES.lightCard).toBe(SEMANTIC.color.surface.card);
    expect(GUARD_SURFACES.darkChrome).toBe(SEMANTIC.color.surface.inverse);
  });
});

describe("shadeHex", () => {
  it("darkens multiplicatively and survives bad input", () => {
    expect(shadeHex("#808080", 0.5)).toBe("#404040");
    expect(shadeHex("not-a-color", 0.5)).toBe("not-a-color");
  });
});
