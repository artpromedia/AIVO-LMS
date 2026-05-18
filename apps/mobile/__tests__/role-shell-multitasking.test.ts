/**
 * Sprint 22 — every role `_layout.tsx` must wire its bottom tabs through
 * `RoleTabletShell`. That's the component that consults
 * `useWindowSizeClass().isTablet` (i.e. `width >= 600pt`) and either:
 *
 *   - returns children only (compact → bottom tabs stay visible), or
 *   - wraps the navigator in `TabletScaffold` with a left rail/drawer.
 *
 * The width math is covered by `ipad-multitasking.test.ts`. This file
 * closes the integration gap flagged in code review by asserting that
 * each role layout actually routes through the shell, so the
 * multitasking matrix translates into the right nav surface per role.
 *
 * Static-source assertions (no RN renderer) keep this test runnable
 * under the existing node-env vitest setup.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(here, "..", "app");

const ROLE_LAYOUTS = [
  "(parent)/_layout.tsx",
  "(learner)/_layout.tsx",
  "(teacher)/_layout.tsx",
  "(caregiver)/_layout.tsx",
  "(therapist)/_layout.tsx",
] as const;

describe("role layouts route through RoleTabletShell", () => {
  for (const rel of ROLE_LAYOUTS) {
    const path = resolve(appDir, rel);
    const src = readFileSync(path, "utf8");

    describe(rel, () => {
      it("imports RoleTabletShell", () => {
        expect(src).toMatch(/from\s+["'][^"']*RoleTabletShell["']/);
      });

      it("wraps the navigator in <RoleTabletShell> with rail destinations", () => {
        expect(src).toMatch(/<RoleTabletShell[\s\S]*destinations=/);
        expect(src).toMatch(/<\/RoleTabletShell>/);
      });

      it("hides the bottom tab bar when isTablet is true", () => {
        // Compact widths (Slide Over, 1/3 / narrow 1/2 splits) leave
        // `isTablet` false and keep the tab bar visible; medium+ widths
        // hide it and the rail in RoleTabletShell takes over.
        expect(src).toMatch(/isTablet\s*\?\s*\{\s*display:\s*["']none["']/);
      });
    });
  }
});
