#!/usr/bin/env node
// green-check: orchestrates the AIVO_LMS production-readiness gate sequence.
//
// Sprint GREEN-00 deliverable. Runs every existing audit/quality gate and
// reports a single red/yellow/green status. Gates that don't yet have a
// dedicated script are listed as "not-implemented" so the dashboard reflects
// reality instead of silently passing.

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

const args = new Set(process.argv.slice(2));
const fastFail = args.has("--fail-fast");
const onlyImplemented = args.has("--only-implemented");

// A gate is either:
//   { name, script: "<pnpm script name>", required: boolean, category }
//   { name, status: "not-implemented", reason, required, category }
//
// `required: true` gates fail the overall run when red.
// `required: false` gates are reported but don't fail the run yet (used for
// gates whose script exists but covers a sprint not finished).
const gates = [
  // Core gates
  { name: "format:check", script: "format:check", required: true, category: "core" },
  { name: "lint", script: "lint", required: true, category: "core" },
  { name: "test", script: "test", required: true, category: "core" },
  { name: "build", script: "build", required: true, category: "core" },
  { name: "api:check", script: "api:check", required: true, category: "core" },

  // Production readiness scanners
  { name: "prod:no-demo", script: "prod:no-demo", required: true, category: "prod" },
  {
    name: "prod:surface-contract",
    script: "prod:surface-contract",
    required: true,
    category: "prod",
  },
  { name: "prod:check", script: "prod:check", required: true, category: "prod" },
  {
    name: "test:production-readiness",
    script: "test:production-readiness",
    required: true,
    category: "prod",
  },
  { name: "test:enterprise", script: "test:enterprise", required: true, category: "prod" },

  // i18n
  { name: "i18n:audit", script: "i18n:audit", required: true, category: "i18n" },

  // Existing domain audits (GREEN-01 .. GREEN-12 will tighten these)
  { name: "consent:audit", script: "consent:audit", required: true, category: "consent" },
  { name: "auth:audit", script: "auth:audit", required: true, category: "auth" },
  {
    name: "curriculum:validate",
    script: "curriculum:validate",
    required: true,
    category: "curriculum",
  },
  {
    name: "onboarding:audit",
    script: "onboarding:audit",
    required: true,
    category: "learner-loop",
  },
  { name: "lessonrun:audit", script: "lessonrun:audit", required: true, category: "learner-loop" },
  { name: "route:audit", script: "route:audit", required: true, category: "ux" },
  { name: "mobile:audit", script: "mobile:audit", required: true, category: "mobile" },
  { name: "marketing:audit", script: "marketing:audit", required: true, category: "marketing" },
  { name: "billing:audit", script: "billing:audit", required: true, category: "ops" },
  { name: "rostering:audit", script: "rostering:audit", required: true, category: "ops" },
  { name: "comms:audit", script: "comms:audit", required: true, category: "ops" },
  { name: "ai-safety:audit", script: "ai-safety:audit", required: true, category: "ai" },
  { name: "accessibility:audit", script: "accessibility:audit", required: true, category: "a11y" },
  { name: "brand:check", script: "brand:check", required: true, category: "brand" },
  { name: "repo:health", script: "repo:health", required: true, category: "core" },

  // Sprint-owned gates implemented in GREEN-01 .. GREEN-03.
  { name: "backend:parity", script: "backend:parity", required: true, category: "backend" },
  { name: "tutor:parity", script: "tutor:parity", required: true, category: "tutor" },
  // Wave E (S10): parity proves tutor CONFIGURATION; this replays fixture
  // sessions through the real orchestrator and proves agentic BEHAVIOUR
  // (observes / closed decision set / guarded / degrades / audited) for
  // every onboarded tutor, with an onboarding ratchet.
  { name: "tutor:behavior", script: "tutor:behavior", required: true, category: "tutor" },
  {
    name: "curriculum:coverage",
    script: "curriculum:coverage",
    required: true,
    category: "curriculum",
  },
  // Wave D (G3): coverage gate over the AUTHORITATIVE curriculum-svc
  // catalogue (ADR-0040) — floor for the CCSS-imported subjects (math/ela
  // K-8 ≥ 15 skills per band) plus a per-cell ratchet.
  {
    name: "catalogue:coverage",
    script: "catalogue:coverage",
    required: true,
    category: "curriculum",
  },

  // Gates owned by later sprints. They are reported here so the gap is
  // visible, but they don't fail the overall run until the sprint that
  // creates the underlying script lands.
  {
    name: "mobile:role-audit",
    script: "mobile:role-audit",
    required: true,
    category: "mobile",
  },
  {
    name: "ux:parity",
    script: "ux:parity",
    required: true,
    category: "ux",
  },
  {
    name: "a11y:audit",
    script: "a11y:audit",
    required: true,
    category: "a11y",
  },
  {
    name: "security:audit",
    script: "security:audit",
    required: true,
    category: "security",
  },
];

const results = [];
let hadRequiredFailure = false;

for (const gate of gates) {
  if (gate.status === "not-implemented") {
    if (onlyImplemented) continue;
    results.push({ ...gate, ok: false, skipped: true });
    continue;
  }

  process.stdout.write(`\n=== gate: ${gate.name} ===\n`);
  const child = spawnSync("pnpm", ["run", "-s", gate.script], {
    cwd: repoRoot,
    stdio: "inherit",
    // shell:true so Windows can resolve pnpm.cmd; harmless on Linux/macOS.
    shell: true,
  });
  const ok = child.status === 0;
  results.push({ ...gate, ok, exitCode: child.status });
  if (!ok && gate.required) {
    hadRequiredFailure = true;
    if (fastFail) break;
  }
}

// Summary
const pad = (s, n) => String(s).padEnd(n);
console.log("\n\n=================== GREEN CHECK SUMMARY ===================");
console.log(pad("gate", 30), pad("status", 18), pad("required", 10), "category");
console.log("-".repeat(90));
for (const r of results) {
  let status;
  if (r.skipped) status = "NOT-IMPLEMENTED";
  else if (r.ok) status = "PASS";
  else status = "FAIL";
  console.log(pad(r.name, 30), pad(status, 18), pad(r.required ? "yes" : "no", 10), r.category);
}
console.log("-".repeat(90));

const requiredImpl = results.filter((r) => r.required && !r.skipped);
const requiredPass = requiredImpl.filter((r) => r.ok).length;
const notImpl = results.filter((r) => r.skipped).length;
console.log(`required gates: ${requiredPass}/${requiredImpl.length} passing`);
console.log(`not-implemented gates: ${notImpl} (tracked in docs/quality/red-to-green-backlog.md)`);

if (hadRequiredFailure) {
  console.log("\nResult: RED. See logs above and docs/quality/green-dashboard.md.");
  process.exit(1);
}
if (notImpl > 0) {
  console.log(
    "\nResult: YELLOW. Required gates pass but sprint-owned gates are not yet implemented.",
  );
  process.exit(0);
}
console.log("\nResult: GREEN.");
process.exit(0);
