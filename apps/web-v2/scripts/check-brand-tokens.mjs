#!/usr/bin/env node
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..", "..");
const tokens = join(root, "packages", "brand", "dist", "css", "tokens.css");
const preset = join(root, "packages", "brand", "dist", "tailwind", "preset.cjs");

const missing = [tokens, preset].filter((p) => !existsSync(p));
if (missing.length > 0) {
  console.error("\n[web-v2] @aivo/brand dist artifacts are missing:");
  for (const path of missing) {
    console.error(`  - ${path}`);
  }
  console.error("\nRun `pnpm --filter @aivo/brand run build` and try again.\n");
  process.exit(1);
}
