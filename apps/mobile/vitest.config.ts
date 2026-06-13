import { coverageConfigDefaults, defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    // src/** added in Sprint 13 for the per-surface tests (this also
    // resurrects src/components/learning/__tests__/stage-announcements,
    // which the old pattern never collected).
    include: ["__tests__/**/*.test.{ts,tsx}", "src/**/__tests__/**/*.test.{ts,tsx}"],
    // Sprint B7 coverage ratchet — ~2 points below the measured baseline
    // (2026-06-11: stmts 75.16 / branch 75.99 / funcs 72.15 / lines 76.87
    // over imported files). Only moves up.
    coverage: {
      provider: "v8",
      reporter: ["text-summary"],
      // Sprint 13: the per-surface RN component files are imported by the
      // surface-logic tests (registry identity assertions) but their render
      // paths CANNOT execute in this node-only harness — no react-native
      // rendering stack exists in the repo. Excluding them from REPORTING
      // keeps the ratchet measuring what it measured before the
      // decomposition (the monolith was never imported by a test, so it
      // never entered the denominator); the new pure modules (types,
      // shared, surface-registry) stay measured and tested.
      exclude: [
        ...coverageConfigDefaults.exclude,
        "src/components/learning/surfaces/**/*.tsx",
        "src/components/learning/surface-renderer.tsx",
        // Imported BY the surfaces (ink workspace) — same unrenderable class.
        "src/components/learning/ScratchPad.tsx",
      ],
      thresholds: {
        statements: 73,
        branches: 74,
        functions: 70,
        lines: 74,
      },
    },
  },
  resolve: {
    alias: {
      // Mirror the `@/*` -> apps/mobile/* path mapping in tsconfig.json
      // so vitest can resolve `import "@/lib/api"` etc. from test files
      // and the hooks they exercise.
      "@/": `${resolve(here)}/`,
      "@aivo/aac-bridge": resolve(here, "../../packages/aac-bridge/src/index.ts"),
      // @aivo/nav is a pure-TS package whose package.json entry points at
      // ./dist/index.js. The mobile vitest job (and CI's mobile-tests) runs
      // straight off a fresh install with no package build step, so the
      // dist isn't there — resolve the source directly, same as aac-bridge.
      // nav-access.test.ts imports the runtime `canAccessArea` value, which
      // is what forces the entry resolution.
      "@aivo/nav": resolve(here, "../../packages/nav/src/index.ts"),
      // The web age-tier mapping lives in @aivo/learner-ui, which is *not*
      // a mobile dependency (it carries React-DOM/CSS-var helpers we never
      // want in the RN bundle). The parity test only needs the single
      // self-contained `age-tiers` source file, so alias that exact module
      // to its source — Vite transforms the TS, no web package install or
      // dist build required. Keeps the alias test-scoped, not app-scoped.
      "@aivo/learner-ui/src/tokens/age-tiers": resolve(
        here,
        "../../packages/learner-ui/src/tokens/age-tiers.ts",
      ),
      // The canonical baseline break cadence lives in @aivo/adaptive-baseline.
      // Mobile MIRRORS the value as a literal (the engine is not in the RN
      // bundle / Metro watch folders); the parity test imports the canonical
      // constant to keep the mirror honest. Alias to source so the test needs
      // no dist build (same rationale as @aivo/nav above).
      "@aivo/adaptive-baseline": resolve(here, "../../packages/adaptive-baseline/src/index.ts"),
    },
  },
});
