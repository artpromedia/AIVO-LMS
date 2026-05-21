/**
 * SplitPane layout decisions across the iPad multitasking matrix.
 *
 * Pairs with `__tests__/ipad-multitasking.test.ts` (which validates
 * `classifyWidth`) to lock in what the SplitPane renders at each size
 * class — stacked on compact and on medium portrait, two-pane on
 * medium landscape, and three-pane only when the host explicitly
 * provides a center panel and the window is at least `expanded`.
 *
 * Pure logic test — no RN renderer needed.
 */
import { describe, expect, it } from "vitest";
import { classifyWidth } from "../src/design/responsive";
import { resolveSplitPaneLayout } from "../src/design/splitPaneLayout";

interface Scenario {
  name: string;
  width: number;
  height: number;
  hasCenter: boolean;
  minSplitClass?: "medium" | "expanded";
  expected: { canSplit: boolean; showThreePane: boolean };
}

const SCENARIOS: Scenario[] = [
  // --- Compact: always stack regardless of orientation or center pane.
  {
    name: "iPhone 14 portrait",
    width: 390,
    height: 844,
    hasCenter: false,
    expected: { canSplit: false, showThreePane: false },
  },
  {
    name: "iPhone 14 landscape",
    width: 844,
    height: 390,
    hasCenter: true,
    // 844dp is expanded — sanity: covered below; this case is for compact 1/2 split:
    // We use 504dp instead.
    expected: { canSplit: true, showThreePane: true },
  },
  {
    name: "iPad portrait 1/2 split (504dp)",
    width: 504,
    height: 768,
    hasCenter: false,
    expected: { canSplit: false, showThreePane: false },
  },

  // --- Medium portrait without center: must stack (no rail, no second column).
  {
    name: "iPad 10.2 full screen portrait (768dp)",
    width: 768,
    height: 1024,
    hasCenter: false,
    expected: { canSplit: false, showThreePane: false },
  },
  // --- Medium portrait with center: split (since center forces a two-pane layout).
  {
    name: "iPad 10.2 full screen portrait + center pane",
    width: 768,
    height: 1024,
    hasCenter: true,
    expected: { canSplit: true, showThreePane: false },
  },
  // --- Medium landscape: two-pane.
  // Note: Real-world iPad multitasking rarely yields a medium-class window
  // with width > height (the host iPad's short side is 768pt, so most
  // "landscape" splits still hand the app a portrait-oriented slice).
  // We use a synthetic 700x500 to verify the (sizeClass===medium &&
  // isLandscape) branch fires; ipad-multitasking.test.ts covers the
  // realistic widths.
  {
    name: "Medium landscape (synthetic 700x500)",
    width: 700,
    height: 500,
    hasCenter: false,
    expected: { canSplit: true, showThreePane: false },
  },
  // --- minSplitClass: 'expanded' suppresses medium splits even in landscape.
  {
    name: "Medium landscape with minSplitClass=expanded",
    width: 700,
    height: 500,
    hasCenter: true,
    minSplitClass: "expanded",
    expected: { canSplit: false, showThreePane: false },
  },

  // --- Expanded: always two-pane; three-pane only when center provided.
  {
    name: "iPad Pro 12.9 landscape full screen (1366dp), no center",
    width: 1366,
    height: 1024,
    hasCenter: false,
    expected: { canSplit: true, showThreePane: false },
  },
  {
    name: "iPad Pro 12.9 landscape full screen (1366dp) + center",
    width: 1366,
    height: 1024,
    hasCenter: true,
    expected: { canSplit: true, showThreePane: true },
  },
  {
    name: "iPad 10.2 landscape full screen (1024dp), no center",
    width: 1024,
    height: 768,
    hasCenter: false,
    expected: { canSplit: true, showThreePane: false },
  },
];

describe("resolveSplitPaneLayout", () => {
  for (const s of SCENARIOS) {
    it(`${s.name} (${s.width}x${s.height})`, () => {
      const sizeClass = classifyWidth(s.width);
      const layout = resolveSplitPaneLayout({
        sizeClass,
        isLandscape: s.width > s.height,
        hasCenter: s.hasCenter,
        minSplitClass: s.minSplitClass,
      });
      expect(layout).toEqual(s.expected);
    });
  }

  it("never returns showThreePane when canSplit is false", () => {
    // Compact + center shouldn't break the contract.
    const layout = resolveSplitPaneLayout({
      sizeClass: "compact",
      isLandscape: true,
      hasCenter: true,
    });
    expect(layout.canSplit).toBe(false);
    expect(layout.showThreePane).toBe(false);
  });

  it("never returns showThreePane on medium even when center is provided", () => {
    const layout = resolveSplitPaneLayout({
      sizeClass: "medium",
      isLandscape: true,
      hasCenter: true,
    });
    expect(layout.canSplit).toBe(true);
    expect(layout.showThreePane).toBe(false);
  });
});
