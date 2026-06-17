import { describe, it, expect } from "vitest";
import { contrastRatio, CONTRAST_NON_TEXT } from "./contrast-guard.js";
import { ADMIN_CHART_PALETTE } from "./generated/admin-chart.js";

// The admin chart series paint non-text graphical objects (lines, slices,
// bars) on the white admin surface, so each must clear WCAG 2.2 AA's >=3:1
// non-text contrast bar. This locks the reference ramp against regressions
// when tokens/semantic/admin.json changes.
describe("ADMIN_CHART_PALETTE contrast on white", () => {
  it.each(ADMIN_CHART_PALETTE.series.map((hex, i) => [i + 1, hex] as const))(
    "series %i (%s) is >= AA non-text contrast on white",
    (_n, hex) => {
      const ratio = contrastRatio(hex, "#FFFFFF");
      expect(ratio).not.toBeNull();
      expect(ratio!).toBeGreaterThanOrEqual(CONTRAST_NON_TEXT);
    },
  );
});
