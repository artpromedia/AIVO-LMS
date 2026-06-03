import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["__tests__/**/*.test.{ts,tsx}"],
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
    },
  },
});
