import { describe, expect, it } from "vitest";
import {
  isPremiumSurface,
  isSurfaceEntitled,
  requiredTutorForSurface,
  requiredTutorsForSurface,
} from "../entitlement/required-tutor.js";

describe("premium-surface entitlement map", () => {
  it("maps each premium surface to the correct owning tutor (Sprint 1 fixes)", () => {
    // coding sandbox -> coding tutor
    expect(requiredTutorsForSurface("coding_sandbox")).toEqual(["pixel"]);
    // art canvas belongs to the art tutor (muse), NOT the music tutor (cadence)
    expect(requiredTutorsForSurface("art_canvas")).toEqual(["muse"]);
    expect(requiredTutorForSurface("art_canvas")).toBe("muse");
    // spoken responses serve speech therapy (echo) first, then world languages
    expect(requiredTutorsForSurface("voice_response")).toEqual(["echo", "lingua"]);
  });

  it("treats non-premium surfaces as free", () => {
    expect(isPremiumSurface("choice_grid")).toBe(false);
    expect(requiredTutorsForSurface("choice_grid")).toEqual([]);
    expect(isSurfaceEntitled("choice_grid", [])).toBe(true);
  });

  it("entitles a multi-owner surface when the learner holds ANY owning tutor", () => {
    // echo-only learner can use voice responses
    expect(isSurfaceEntitled("voice_response", ["echo"])).toBe(true);
    // lingua-only learner can use voice responses
    expect(isSurfaceEntitled("voice_response", ["lingua"])).toBe(true);
    // a learner with neither cannot
    expect(isSurfaceEntitled("voice_response", ["nova"])).toBe(false);
  });

  it("gates the art canvas on muse (not cadence)", () => {
    expect(isSurfaceEntitled("art_canvas", ["muse"])).toBe(true);
    expect(isSurfaceEntitled("art_canvas", ["cadence"])).toBe(false);
  });

  it("default-allows while entitlements are still loading (undefined)", () => {
    expect(isSurfaceEntitled("voice_response", undefined)).toBe(true);
    expect(isSurfaceEntitled("art_canvas", undefined)).toBe(true);
  });
});
