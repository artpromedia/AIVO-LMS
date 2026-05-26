/**
 * Sprint 12.6 — smoke test for @aivo/mobile-ui.
 *
 * The package's main exports are React Native components (AivoButton,
 * AivoCard, MobileLearningHero, ...) that need a Metro / RN runtime
 * to render. Its pure-data modules (`theme`, `responsive`) transitively
 * import `@aivo/brand`, which ships a TS source for type-check and a
 * generated `dist/` for runtime — vitest's node resolver can't load
 * the latter without a prior `pnpm --filter @aivo/brand build`.
 *
 * Rather than add a build step to CI just to satisfy a smoke test,
 * this file does a non-React shape check on the package manifest +
 * the index source. Render-level + integration coverage lives in
 * apps/mobile snapshot tests.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const packageRoot = resolve(__dirname, "..");

describe("@aivo/mobile-ui smoke", () => {
  it("declares the documented package shape", () => {
    const pkg = JSON.parse(readFileSync(resolve(packageRoot, "package.json"), "utf8"));
    expect(pkg.name).toBe("@aivo/mobile-ui");
    expect(pkg.private).toBe(true);
    expect(pkg.peerDependencies?.react).toMatch(/>=18/);
    expect(pkg.peerDependencies?.["react-native"]).toMatch(/>=0\.7/);
  });

  it("ships an importable entry point", () => {
    expect(existsSync(resolve(packageRoot, "src/index.ts"))).toBe(true);
    const src = readFileSync(resolve(packageRoot, "src/index.ts"), "utf8");
    // The shell exposes the documented primitives — drift here means
    // an apps/mobile consumer would break at build time.
    expect(src).toMatch(/AivoButton/);
    expect(src).toMatch(/AivoCard/);
    expect(src).toMatch(/MobileLearningHero/);
  });
});
