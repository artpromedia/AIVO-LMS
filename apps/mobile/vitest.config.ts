import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["__tests__/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@aivo/aac-bridge": resolve(here, "../../packages/aac-bridge/src/index.ts"),
      // @aivo/nav is a pure-TS package whose package.json entry points at
      // ./dist/index.js. The mobile vitest job (and CI's mobile-tests) runs
      // straight off a fresh install with no package build step, so the
      // dist isn't there — resolve the source directly, same as aac-bridge.
      // nav-access.test.ts imports the runtime `canAccessArea` value, which
      // is what forces the entry resolution.
      "@aivo/nav": resolve(here, "../../packages/nav/src/index.ts"),
    },
  },
});
