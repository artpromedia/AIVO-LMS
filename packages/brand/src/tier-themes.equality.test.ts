import { describe, it, expect } from "vitest";
import { TIER_THEME_DATA } from "./generated/tier-themes.js";

/**
 * Sprint B7 equivalence proof: the generated tier data must equal the
 * literal palettes that shipped before the token consolidation (the
 * values the Sprint A1 visual baselines captured). These frozen copies
 * are the pre-refactor sources verbatim — packages/learner-ui
 * src/tokens/age-tiers.ts and packages/mobile-ui src/tierTheme.ts.
 * If a designer changes tokens/modes/tier-themes.json, THIS test is the
 * deliberate place that change gets acknowledged.
 */
const LEGACY_WEB = {
  EARLY: {
    colors: {
      bg: "#FFFAEF",
      surface: "#FFFCF4",
      surfaceAlt: "#FBF1DE",
      primary: "#7C3AED",
      primarySoft: "#EDE3FE",
      accent: "#FFB700",
      text: "#292F3D",
      textSoft: "#5C5067",
      sky: "#EDE3FE",
      warm: "#F8C4A0",
    },
    radius: { sm: 14, md: 22, lg: 32, pill: 999 },
    paceMultiplier: 1.5,
    name: "Soft Meadow",
  },
  MIDDLE: {
    colors: {
      bg: "#1F1535",
      surface: "#2A1F4D",
      surfaceAlt: "#3A2D52",
      primary: "#7C3AED",
      primarySoft: "rgba(124, 58, 237, 0.2)",
      accent: "#FFB700",
      text: "#F5EBD8",
      textSoft: "#B89A72",
      sky: "#3F2D6E",
      warm: "#5D7A5C",
    },
    radius: { sm: 10, md: 14, lg: 20, pill: 999 },
    paceMultiplier: 1.0,
    name: "Study Treehouse",
  },
  HIGH: {
    colors: {
      bg: "#F4EFE6",
      surface: "#FAF6EE",
      surfaceAlt: "#EDE6D6",
      primary: "#7C3AED",
      primarySoft: "#E5DBF5",
      accent: "#FFB700",
      text: "#292F3D",
      textSoft: "#5C5067",
      sky: "#E5DBF5",
      warm: "#FFE08A",
    },
    radius: { sm: 8, md: 10, lg: 16, pill: 999 },
    paceMultiplier: 0.8,
    name: "Focus Studio",
  },
} as const;

const LEGACY_MOBILE_EXTRAS = {
  EARLY: { tabBar: "#FFFCF4", tabBarActive: "#7C3AED", tabBarInactive: "#9189A1", border: "#F0E4D2" },
  MIDDLE: { tabBar: "#2A1F4D", tabBarActive: "#FFB700", tabBarInactive: "#B89A72", border: "#3A2D52" },
  HIGH: { tabBar: "#FAF6EE", tabBarActive: "#7C3AED", tabBarInactive: "#9189A1", border: "#E5DBF5" },
} as const;

describe("tier-theme token consolidation equivalence", () => {
  for (const tier of ["EARLY", "MIDDLE", "HIGH"] as const) {
    it(`${tier} palette matches the pre-consolidation shipped literals`, () => {
      const data = TIER_THEME_DATA[tier];
      expect(data.colors).toEqual(LEGACY_WEB[tier].colors);
      expect(data.radius).toEqual(LEGACY_WEB[tier].radius);
      expect(data.paceMultiplier).toBe(LEGACY_WEB[tier].paceMultiplier);
      expect(data.name).toBe(LEGACY_WEB[tier].name);
      expect(data.mobile).toEqual(LEGACY_MOBILE_EXTRAS[tier]);
    });
  }
});
