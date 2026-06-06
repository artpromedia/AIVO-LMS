/**
 * Responsive-adoption guard — Phone & Tablet hardening pass.
 *
 * Sibling to `role-shell-multitasking.test.ts`: that file locks the *nav
 * surface* (rail vs. bottom tabs) per role; this one locks *screen
 * adoption* of the shared scaffolding so a future edit can't silently
 * reintroduce a full-bleed, hand-rolled-inset screen root on tablets.
 *
 * Two invariants are asserted via static source reads (no RN renderer,
 * so it runs under the existing node-env vitest setup):
 *
 *   1. Top-level surfaces that were migrated off bare
 *      `ScrollView`/`SafeAreaView`+`insets.top` roots route through
 *      `ResponsiveScreen` with the documented `maxWidth`.
 *   2. True card/tile grids drive their column count from
 *      `gridColumns(sizeClass)` (the single source in `responsive.ts`)
 *      rather than a hard-coded width.
 *
 * The migration list these cases mirror lives in
 * `apps/mobile/docs/responsive-hardening.md` (§ Migration list).
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(here, "..", "app");

function read(rel: string): string {
  return readFileSync(resolve(appDir, rel), "utf8");
}

/** Screens that must root through <ResponsiveScreen> after the migration. */
const RESPONSIVE_SCREENS: { rel: string; maxWidth: string }[] = [
  { rel: "messages.tsx", maxWidth: "reading" },
  { rel: "notifications.tsx", maxWidth: "reading" },
  { rel: "(parent)/recommendations.tsx", maxWidth: "dashboard" },
  { rel: "(learner)/shop.tsx", maxWidth: "dashboard" },
];

describe("migrated screens adopt ResponsiveScreen", () => {
  for (const { rel, maxWidth } of RESPONSIVE_SCREENS) {
    const src = read(rel);
    describe(rel, () => {
      it("imports ResponsiveScreen", () => {
        expect(src).toMatch(/import\s*\{[^}]*\bResponsiveScreen\b[^}]*\}\s*from/);
      });

      it("renders a <ResponsiveScreen> root", () => {
        expect(src).toMatch(/<ResponsiveScreen[\s>]/);
      });

      it(`uses maxWidth="${maxWidth}"`, () => {
        expect(src).toMatch(new RegExp(`maxWidth=["']${maxWidth}["']`));
      });
    });
  }
});

/** True tile grids — column count must come from gridColumns(sizeClass). */
const GRID_SCREENS = [
  "(learner)/index.tsx",
  "(learner)/badges.tsx",
  "(learner)/shop.tsx",
] as const;

describe("tile grids drive columns from gridColumns(sizeClass)", () => {
  for (const rel of GRID_SCREENS) {
    const src = read(rel);
    describe(rel, () => {
      it("imports gridColumns from the responsive source of truth", () => {
        expect(src).toMatch(/import\s*\{[^}]*\bgridColumns\b[^}]*\}\s*from\s*["'][^"']*responsive["']/);
      });

      it("invokes gridColumns(sizeClass)", () => {
        expect(src).toMatch(/gridColumns\(\s*sizeClass\s*\)/);
      });
    });
  }
});

describe("shop drops the hard-coded 2-up grid width", () => {
  it('no longer pins itemCard to width: "47%"', () => {
    const src = read("(learner)/shop.tsx");
    expect(src).not.toMatch(/width:\s*["']47%["']/);
  });
});
