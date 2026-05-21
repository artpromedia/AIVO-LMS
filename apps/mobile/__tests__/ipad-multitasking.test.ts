/**
 * iPadOS Split View / Slide Over size-class matrix.
 *
 * Locks the behaviour documented in
 * `apps/mobile/src/design/useWindowSizeClass.ts` so a future tweak to
 * `responsive.ts` breakpoints can't silently regress what nav surface the
 * shell renders in each multitasking ratio.
 *
 * Width values below come from Apple's iPadOS layout guides:
 *   - Slide Over is always 320pt (iPad <= 10.2") or 375pt (iPad >= 11").
 *   - Split View ratios are 1/3, 1/2, 2/3 of the host iPad's long side
 *     (landscape) or short side (portrait).
 */
import { describe, expect, it } from "vitest";
import {
  classifyWidth,
  isTabletWidth,
  type SizeClass,
} from "../src/design/responsive";
import { resolveStageLayout } from "../src/design/stageLayout";

type Case = {
  name: string;
  width: number;
  height: number;
  expected: SizeClass;
  isTablet: boolean;
};

const SLIDE_OVER: Case[] = [
  { name: "Slide Over, small iPad", width: 320, height: 1024, expected: "compact", isTablet: false },
  { name: "Slide Over, iPad 11\"+", width: 375, height: 1194, expected: "compact", isTablet: false },
];

const ONE_THIRD: Case[] = [
  { name: "1/3 split, iPad 10.2\" landscape", width: 320, height: 768, expected: "compact", isTablet: false },
  { name: "1/3 split, iPad 11\" landscape", width: 375, height: 834, expected: "compact", isTablet: false },
  { name: "1/3 split, iPad Pro 12.9\" landscape", width: 375, height: 1024, expected: "compact", isTablet: false },
];

const ONE_HALF: Case[] = [
  { name: "1/2 split, iPad portrait (any)", width: 504, height: 768, expected: "compact", isTablet: false },
  { name: "1/2 split, iPad 10.2\" landscape", width: 507, height: 768, expected: "compact", isTablet: false },
  { name: "1/2 split, iPad 11\" landscape", width: 590, height: 834, expected: "compact", isTablet: false },
  { name: "1/2 split, iPad Pro 12.9\" landscape", width: 678, height: 1024, expected: "medium", isTablet: true },
];

const TWO_THIRDS: Case[] = [
  { name: "2/3 split, iPad 10.2\" portrait", width: 438, height: 1024, expected: "compact", isTablet: false },
  { name: "2/3 split, iPad Pro 12.9\" portrait", width: 639, height: 1366, expected: "medium", isTablet: true },
  { name: "2/3 split, iPad 10.2\" landscape", width: 694, height: 768, expected: "medium", isTablet: true },
  { name: "2/3 split, iPad 11\" landscape", width: 791, height: 834, expected: "medium", isTablet: true },
  { name: "2/3 split, iPad Pro 12.9\" landscape", width: 981, height: 1024, expected: "expanded", isTablet: true },
];

const FULL_SCREEN: Case[] = [
  { name: "Full screen, iPad 10.2\" portrait", width: 768, height: 1024, expected: "medium", isTablet: true },
  { name: "Full screen, iPad Pro 12.9\" portrait", width: 1024, height: 1366, expected: "expanded", isTablet: true },
  { name: "Full screen, iPad 10.2\" landscape", width: 1024, height: 768, expected: "expanded", isTablet: true },
  { name: "Full screen, iPad Pro 12.9\" landscape", width: 1366, height: 1024, expected: "expanded", isTablet: true },
];

describe("iPadOS multitasking → size class", () => {
  const groups: [string, Case[]][] = [
    ["Slide Over", SLIDE_OVER],
    ["1/3 Split View", ONE_THIRD],
    ["1/2 Split View", ONE_HALF],
    ["2/3 Split View", TWO_THIRDS],
    ["Full screen", FULL_SCREEN],
  ];

  for (const [group, cases] of groups) {
    describe(group, () => {
      for (const c of cases) {
        it(`${c.name} (${c.width}x${c.height}) -> ${c.expected}`, () => {
          expect(classifyWidth(c.width)).toBe(c.expected);
          expect(isTabletWidth(c.width)).toBe(c.isTablet);
        });
      }
    });
  }

  it("every Slide Over and 1/3 Split View width falls into compact", () => {
    // Compact == phone-style bottom tabs + no rail. This is the load-
    // bearing invariant for the multitasking UX: an 84pt rail at 320pt
    // total width would leave only ~236pt for content.
    for (const c of [...SLIDE_OVER, ...ONE_THIRD]) {
      expect(classifyWidth(c.width)).toBe("compact");
      expect(isTabletWidth(c.width)).toBe(false);
    }
  });

  it("compact threshold sits at 600pt", () => {
    // Locks the boundary documented in useWindowSizeClass.ts. Dropping
    // this below 600 would re-introduce a rail at 590pt (1/2 split,
    // iPad 11" landscape) which crowds the dashboard cards; raising it
    // above 678 would lose the rail on iPad Pro 12.9" half-split
    // landscape where there's plenty of room.
    expect(classifyWidth(599)).toBe("compact");
    expect(classifyWidth(600)).toBe("medium");
  });
});

describe("iPadOS multitasking → stage layout", () => {
  it("Slide Over stacks the stage (no room to split)", () => {
    for (const c of SLIDE_OVER) {
      expect(resolveStageLayout(c.width, c.height).mode).toBe("stacked");
    }
  });

  it("1/3 and 1/2 Split View stack the stage on every iPad", () => {
    for (const c of [...ONE_THIRD, ...ONE_HALF]) {
      expect(resolveStageLayout(c.width, c.height).mode).toBe("stacked");
    }
  });

  it("2/3 Split View stacks unless the pane is in expanded landscape", () => {
    for (const c of TWO_THIRDS) {
      const layout = resolveStageLayout(c.width, c.height);
      const isLandscape = c.width > c.height;
      const expectedSplit =
        c.expected === "expanded" || (c.expected === "medium" && isLandscape);
      expect(layout.mode).toBe(expectedSplit ? "split" : "stacked");
    }
  });
});
