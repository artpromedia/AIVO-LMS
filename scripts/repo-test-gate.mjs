#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const turbo = require.resolve("turbo/bin/turbo");
const forwardedArgs = process.argv.slice(2);

process.stdout.write(
  [
    "Running deterministic repo tests sequentially.",
    "The live @aivo/e2e Playwright suite is excluded because it requires the provisioned E2E harness.",
    "Run `pnpm test:e2e` for the full live browser suite.",
    "",
  ].join("\n"),
);

const result = spawnSync(
  process.execPath,
  [turbo, "run", "test", "--concurrency=1", "--filter=!@aivo/e2e", ...forwardedArgs],
  {
    stdio: "inherit",
  },
);

if (result.error) {
  console.error(`Unable to start the repo test gate: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
