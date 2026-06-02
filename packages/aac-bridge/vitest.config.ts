import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    // Cold dynamic-import of the React-side index module can take >5s on
    // Windows; the 15s ceiling keeps the suite snappy while removing
    // flakiness in the AACTargetProvider exports smoke test.
    testTimeout: 15000,
  },
});
