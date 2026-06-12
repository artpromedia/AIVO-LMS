import { describe, expect, it } from "vitest";
import { SKELETON_OPACITY_RANGE, SKELETON_PULSE_MS, skeletonMotion } from "../Skeleton";

describe("skeletonMotion", () => {
  it("animates by default with the documented pulse duration", () => {
    const m = skeletonMotion(false);
    expect(m.animate).toBe(true);
    expect(m.durationMs).toBe(SKELETON_PULSE_MS);
  });

  it("reduce-motion freezes at the midpoint opacity (no loop)", () => {
    const m = skeletonMotion(true);
    expect(m.animate).toBe(false);
    const [lo, hi] = SKELETON_OPACITY_RANGE;
    expect(m.staticOpacity).toBeGreaterThan(lo);
    expect(m.staticOpacity).toBeLessThan(hi);
  });
});
