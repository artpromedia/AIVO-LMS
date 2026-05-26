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
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

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
  { name: "mobile:audit", cmd: ["pnpm", "mobile:audit"] },
  { name: "marketing:audit", cmd: ["pnpm", "marketing:audit"] },
  { name: "billing:audit", cmd: ["pnpm", "billing:audit"] },
  { name: "rostering:audit", cmd: ["pnpm", "rostering:audit"] },
  { name: "comms:audit", cmd: ["pnpm", "comms:audit"] },
  { name: "ai-safety:audit", cmd: ["pnpm", "ai-safety:audit"] },
  { name: "accessibility:audit", cmd: ["pnpm", "accessibility:audit"] },
  { name: "prod:no-demo", cmd: ["pnpm", "prod:no-demo"] },
  { name: "prod:surface-contract", cmd: ["pnpm", "prod:surface-contract"] },
  { name: "prod:check", cmd: ["pnpm", "prod:check"] },
  // Sprint 16 — every-route audit coverage scanner. Currently runs in
  // --warn mode in CI; the release-gate also runs it in --warn so we
  // still get the report without blocking release until the 250+
  // historical gaps are filled (see scripts/ci/results/audit-coverage-initial.json).
  { name: "audit-coverage", cmd: ["node", "scripts/ci/audit-coverage-check.mjs", "--warn"] },
];

/**
 * Sprint 16 — release-discipline gates beyond the per-domain audits.
 * These are quick filesystem assertions that prove SOC 2 prerequisites
 * are met before we ship. They fail with a descriptive message rather
 * than running another sub-process.
 */
function checkSoc2Matrix() {
  const matrixPath = join(repoRoot, "docs", "security", "soc2-control-matrix.md");
  if (!fs.existsSync(matrixPath)) {
    return { ok: false, msg: `Missing ${matrixPath}` };
  }
  const src = fs.readFileSync(matrixPath, "utf8");
  // Allow `TODO(sprint-XX)` markers during in-flight sprints, but the
  // release-gate requires the matrix to declare itself zero-TODO via a
  // single-line marker. Once the file contains the line
  // `<!-- soc2-matrix: zero-todos -->` it is enforced.
  const enforcedMarker = /<!--\s*soc2-matrix:\s*zero-todos\s*-->/;
  if (!enforcedMarker.test(src)) {
    return {
      ok: true,
      msg: "soc2-control-matrix.md present (TODO enforcement not yet flipped on)",
    };
  }
  const todoMatches = src.match(/TODO\([^)]*\)/g) || [];
  if (todoMatches.length > 0) {
    return {
      ok: false,
      msg: `soc2-control-matrix.md has ${todoMatches.length} TODO(...) markers after zero-todos was declared`,
    };
  }
  return { ok: true, msg: "soc2-control-matrix.md has zero TODOs" };
}

function checkDrDrill() {
  const dir = join(repoRoot, "scripts", "dr", "results");
  if (!fs.existsSync(dir)) {
    return { ok: false, msg: `Missing ${dir} — run scripts/dr/backup-restore-drill.sh first` };
  }
  const entries = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  if (entries.length === 0) {
    return { ok: false, msg: "No DR drill reports under scripts/dr/results/" };
  }
  let newest = 0;
  for (const f of entries) {
    const st = fs.statSync(join(dir, f));
    if (st.mtimeMs > newest) newest = st.mtimeMs;
  }
  const ageDays = (Date.now() - newest) / 86_400_000;
  if (ageDays > 90) {
    return {
      ok: false,
      msg: `Last DR drill ${ageDays.toFixed(0)} days old (must be < 90)`,
    };
  }
  return { ok: true, msg: `Last DR drill ${ageDays.toFixed(0)} days ago` };
}

function checkSecurityReviewsSigned() {
  const docsDir = join(repoRoot, "docs");
  if (!fs.existsSync(docsDir)) return { ok: true, msg: "no docs/ dir; skipping" };
  const files = fs
    .readdirSync(docsDir)
    .filter((f) => /SPRINT_.*_SECURITY_REVIEW\.md$/i.test(f));
  if (files.length === 0) {
    return { ok: true, msg: "no SPRINT_*_SECURITY_REVIEW.md files found" };
  }
  const unsigned = [];
  for (const f of files) {
    const src = fs.readFileSync(join(docsDir, f), "utf8");
    // Convention: each review ends with a `Signed-off-by:` trailer.
    // Files explicitly marked `Status: DRAFT` or containing
    // `Sign-off pending` are considered unsigned.
    if (/Signed-off-by:/i.test(src) && !/Sign-off pending/i.test(src)) continue;
    unsigned.push(f);
  }
  if (unsigned.length > 0) {
    return { ok: false, msg: `Unsigned security reviews: ${unsigned.join(", ")}` };
  }
  return { ok: true, msg: `${files.length} security review(s) signed off` };
}

function checkFeatureFlagsAt100() {
  // Sprint 16 — verify the enterprise feature flag rollout file marks
  // every flag at 100% in staging for at least 72 hours. The rollout
  // ledger lives at infra/feature-flags/rollout.json when configured;
  // when absent we soft-pass and emit a TODO so engineering knows to
  // populate it before flipping the matrix to zero-TODO mode.
  const ledger = join(repoRoot, "infra", "feature-flags", "rollout.json");
  if (!fs.existsSync(ledger)) {
    return {
      ok: true,
      msg: "infra/feature-flags/rollout.json absent (soft-pass — populate before zero-todos flip)",
    };
  }
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(ledger, "utf8"));
  } catch (e) {
    return { ok: false, msg: `Cannot parse ${ledger}: ${(e && e.message) || e}` };
  }
  const flags = parsed?.staging?.flags || [];
  const NOW = Date.now();
  const SEVENTY_TWO_H = 72 * 60 * 60 * 1000;
  const bad = [];
  for (const f of flags) {
    if (typeof f.percent === "number" && f.percent < 100) bad.push(`${f.name}@${f.percent}%`);
    if (f.percent === 100 && f.rolledOutAt) {
      const at = Date.parse(f.rolledOutAt);
      if (Number.isFinite(at) && NOW - at < SEVENTY_TWO_H) {
        bad.push(`${f.name} only ${(((NOW - at) / 3_600_000) | 0)}h at 100%`);
      }
    }
  }
  if (bad.length > 0) return { ok: false, msg: `Flags failing 100%/72h gate: ${bad.join(", ")}` };
  return { ok: true, msg: `${flags.length} enterprise flag(s) at 100% for 72h+ in staging` };
}

const SOFT_GATES = [
  { name: "soc2:matrix-zero-todos", check: checkSoc2Matrix },
  { name: "dr:drill-within-90d", check: checkDrDrill },
  { name: "security:reviews-signed", check: checkSecurityReviewsSigned },
  { name: "feature-flags:100pct-staging-72h", check: checkFeatureFlagsAt100 },
];

const results = [];
let failures = 0;

for (const gate of GATES) {
  process.stdout.write(`\n── ${gate.name} ───────────────────────────────\n`);
  const t0 = Date.now();
  const result = spawnSync(gate.cmd[0], gate.cmd.slice(1), {
    cwd: repoRoot,
    stdio: "inherit",
  });
  const ms = Date.now() - t0;
  const ok = result.status === 0;
  results.push({ name: gate.name, ok, ms });
  if (!ok) failures++;
}

process.stdout.write(`\n── Sprint 16 release gates ───────────────────────────\n`);
for (const sg of SOFT_GATES) {
  const t0 = Date.now();
  let res;
  try {
    res = sg.check();
  } catch (e) {
    res = { ok: false, msg: (e && e.message) || String(e) };
  }
  const ms = Date.now() - t0;
  results.push({ name: sg.name, ok: res.ok, ms });
  if (!res.ok) failures++;
  process.stdout.write(`${res.ok ? "PASS" : "FAIL"}  ${sg.name}: ${res.msg}\n`);
}

process.stdout.write(`\n══ release:gate summary ═══════════════════════\n`);
for (const r of results) {
  const mark = r.ok ? "PASS" : "FAIL";
  process.stdout.write(`${mark}  ${r.name.padEnd(36)} ${r.ms} ms\n`);
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
