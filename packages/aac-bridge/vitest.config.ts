import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // vitest 4 dropped dist/ from the default excludes; without this the
    // tsc-compiled copies under dist/__tests__ run too (and fail — their
    // fixture paths only exist under src/).
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    environment: "node",
    globals: false,
    // Cold dynamic-import of the React-side index module can take >5s on
    // Windows; the 15s ceiling keeps the suite snappy while removing
    // flakiness in the AACTargetProvider exports smoke test.
    testTimeout: 15000,
  },
});
