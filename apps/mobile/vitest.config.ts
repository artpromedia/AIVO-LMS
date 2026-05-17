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
    },
  },
});
