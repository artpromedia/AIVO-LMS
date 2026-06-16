import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { contrastRatio } from "./contrast-guard.js";

// Locks Phase 0 / F1 of the Inclusive-Warm conversion: the universal soft
// status tokens (`bg-iw-*-subtle` chip backgrounds + `text-iw-*-strong`
// accessible chip text) must be emitted by `scripts/build-tokens.mjs` into
// both the compiled CSS vars and the Tailwind preset. These are the
// replacement target for every `bg-emerald-50` / `bg-amber-50` / `bg-rose-50`
// chip across the apps, so they cannot silently regress.

const dir = path.dirname(fileURLToPath(import.meta.url));
const css = fs.readFileSync(path.join(dir, "../dist/css/tokens.css"), "utf8");
const preset = fs.readFileSync(path.join(dir, "../dist/tailwind/preset.cjs"), "utf8");
// The preset template aligns values with variable whitespace; collapse runs of
// whitespace so substring assertions don't depend on the alignment padding.
const presetNorm = preset.replace(/\s+/g, " ");

const STATUSES = ["success", "warning", "error", "info"] as const;
const SUFFIXES = ["subtle", "strong"] as const;

const SUBTLE_HEX: Record<(typeof STATUSES)[number], string> = {
  success: "#dcfce7",
  warning: "#fef3c7",
  error: "#fee2e2",
  info: "#ede9fe",
};
const STRONG_HEX: Record<(typeof STATUSES)[number], string> = {
  success: "#15803d",
  warning: "#b45309",
  error: "#b91c1c",
  info: "#6d28d9",
};

describe("inclusive-warm soft status tokens (Phase 0 / F1)", () => {
  it("emits the CSS variables for every status × suffix", () => {
    for (const status of STATUSES) {
      for (const suffix of SUFFIXES) {
        expect(css).toContain(`--aivo-color-status-${status}-${suffix}:`);
      }
    }
  });

  it("emits the exact subtle / strong hexes", () => {
    for (const status of STATUSES) {
      expect(css).toContain(`--aivo-color-status-${status}-subtle: ${SUBTLE_HEX[status]};`);
      expect(css).toContain(`--aivo-color-status-${status}-strong: ${STRONG_HEX[status]};`);
    }
  });

  it("wires the iw-* Tailwind utilities to those vars", () => {
    for (const status of STATUSES) {
      for (const suffix of SUFFIXES) {
        expect(presetNorm).toContain(
          `"${status}-${suffix}": "var(--aivo-color-status-${status}-${suffix})"`,
        );
      }
    }
  });

  it("keeps `iw-error` canonical (no `danger` alias)", () => {
    expect(presetNorm).toContain('error: "var(--aivo-color-status-error)"');
    expect(preset).not.toMatch(/danger/i);
  });

  it("strong-on-subtle chip pairs meet WCAG AA (4.5:1)", () => {
    for (const status of STATUSES) {
      const ratio = contrastRatio(STRONG_HEX[status], SUBTLE_HEX[status]);
      expect(ratio).not.toBeNull();
      expect(ratio!).toBeGreaterThanOrEqual(4.5);
    }
  });
});
