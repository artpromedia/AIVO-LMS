#!/usr/bin/env node
// release:gate — Sprint 16 aggregator.
//
// Runs every Sprint 00–15 audit + the production-readiness scans in
// sequence and produces a single PASS / FAIL decision. The exit code
// is the OR of every sub-gate's exit code.
//
// This script is what an on-call engineer runs before deploying. It
// mirrors what .github/workflows/production-gates.yml runs in CI, so
// a green local run plus a green CI run is the merge bar.

import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

// Gates run in dependency order: structure → conventions → compliance
// → product → release scans. Adding a new gate? Add it here AND in
// .github/workflows/production-gates.yml.
const GATES = [
  { name: "repo:health", cmd: ["pnpm", "repo:health"] },
  { name: "brand:check", cmd: ["pnpm", "brand:check"] },
  { name: "auth:audit", cmd: ["pnpm", "auth:audit"] },
  { name: "consent:audit", cmd: ["pnpm", "consent:audit"] },
  { name: "curriculum:validate", cmd: ["pnpm", "curriculum:validate"] },
  { name: "onboarding:audit", cmd: ["pnpm", "onboarding:audit"] },
  { name: "lessonrun:audit", cmd: ["pnpm", "lessonrun:audit"] },
  { name: "route:audit", cmd: ["pnpm", "route:audit"] },
  { name: "shell:audit", cmd: ["pnpm", "shell:audit"] },
  { name: "mobile:single-listing", cmd: ["pnpm", "mobile:single-listing"] },
  { name: "mobile:audit", cmd: ["pnpm", "mobile:audit"] },
  { name: "marketing:audit", cmd: ["pnpm", "marketing:audit"] },
  { name: "billing:audit", cmd: ["pnpm", "billing:audit"] },
  { name: "rostering:audit", cmd: ["pnpm", "rostering:audit"] },
  { name: "comms:audit", cmd: ["pnpm", "comms:audit"] },
  { name: "ai-safety:audit", cmd: ["pnpm", "ai-safety:audit"] },
  { name: "accessibility:audit", cmd: ["pnpm", "accessibility:audit"] },
  { name: "observability:audit", cmd: ["pnpm", "observability:audit"] },
  { name: "prod:no-demo", cmd: ["pnpm", "prod:no-demo"] },
  { name: "prod:surface-contract", cmd: ["pnpm", "prod:surface-contract"] },
  { name: "prod:check", cmd: ["pnpm", "prod:check"] },
];

const results = [];
let failures = 0;

// On Windows, `pnpm` resolves to `pnpm.cmd`, which Node's spawnSync cannot
// execute without `shell: true`. Using shell: true on every platform keeps
// behavior consistent and was previously the cause of a 20/20 false-fail
// when running release:gate from a Windows PowerShell session.
const SPAWN_OPTS = {
  cwd: repoRoot,
  stdio: "inherit",
  shell: true,
};

for (const gate of GATES) {
  process.stdout.write(`\n── ${gate.name} ───────────────────────────────\n`);
  const t0 = Date.now();
  const result = spawnSync(gate.cmd[0], gate.cmd.slice(1), SPAWN_OPTS);
  const ms = Date.now() - t0;
  const ok = result.status === 0;
  results.push({ name: gate.name, ok, ms });
  if (!ok) failures++;
}

process.stdout.write(`\n══ release:gate summary ═══════════════════════\n`);
for (const r of results) {
  const mark = r.ok ? "PASS" : "FAIL";
  process.stdout.write(`${mark}  ${r.name.padEnd(28)} ${r.ms} ms\n`);
}
process.stdout.write(`\n${results.length} gate(s) run; ${failures} failure(s).\n`);

if (failures > 0) {
  process.stdout.write(
    "release:gate FAILED — do not deploy. Fix the failing gate(s) and re-run.\n",
  );
  process.exit(1);
}

process.stdout.write(
  "release:gate PASSED — production-readiness checks green. Continue with docs/release/production-release-checklist.md sections 3+.\n",
);
