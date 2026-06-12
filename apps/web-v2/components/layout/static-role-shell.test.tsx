/**
 * Lockstep guard: the boundary shell's static destinations must stay a
 * subset of the real role navs in role-shells.tsx. That module can't be
 * imported here (module-scope JSX under the app's automatic runtime, plus
 * a @aivo/security → Node fs graph), so the guard reads its source: every
 * STATIC_NAV href must appear as a nav href in role-shells.tsx.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { STATIC_NAV } from "./static-role-shell";

const roleShellsSource = readFileSync(join(__dirname, "role-shells.tsx"), "utf8");

describe("StaticRoleShell nav lockstep", () => {
  for (const role of Object.keys(STATIC_NAV) as Array<keyof typeof STATIC_NAV>) {
    it(`${role} boundary destinations exist in role-shells.tsx`, () => {
      for (const item of STATIC_NAV[role]) {
        expect(
          roleShellsSource.includes(`href: "${item.href}"`),
          `${item.href} missing from role-shells.tsx`,
        ).toBe(true);
      }
    });
  }
});
