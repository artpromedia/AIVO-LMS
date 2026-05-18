#!/usr/bin/env node
/**
 * Production Readiness Gate.
 *
 * Aggregates results from the no-demo-prod scanner and surface-contract
 * scanner, plus a small number of repo-level structural checks. Designed to
 * be invoked locally and from CI.
 *
 * Exit codes:
 *   0  — production-ready
 *   1  — one or more blockers found (always nonzero when NODE_ENV=production)
 *
 * When NODE_ENV !== "production" the script reports findings as WARNINGS but
 * still exits 0 unless --strict is passed, so developers can iterate.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "..");

const STRICT = process.argv.includes("--strict");
const IS_PROD = process.env.NODE_ENV === "production";

/** @type {{ id: string; severity: "blocker"|"warning"; message: string; hint?: string }[]} */
const findings = [];

function blocker(id, message, hint) {
  findings.push({ id, severity: "blocker", message, hint });
}
function warn(id, message, hint) {
  findings.push({ id, severity: "warning", message, hint });
}

function readJson(rel) {
  const p = resolve(REPO_ROOT, rel);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

function hasScript(pkg, name) {
  return Boolean(pkg && pkg.scripts && typeof pkg.scripts[name] === "string");
}

function runChildScript(rel, label) {
  const p = resolve(REPO_ROOT, rel);
  if (!existsSync(p)) {
    blocker(`missing:${label}`, `Required helper script missing: ${rel}`);
    return false;
  }
  const result = spawnSync(process.execPath, [p], {
    cwd: REPO_ROOT,
    env: { ...process.env, AIVO_PROD_CHECK_CHILD: "1" },
    stdio: "inherit",
  });
  return result.status === 0;
}

// ---------------------------------------------------------------------------
// 1. Root package.json must expose minimum production scripts.
// ---------------------------------------------------------------------------
const rootPkg = readJson("package.json");
if (!rootPkg) {
  blocker("root-package", "Root package.json missing or unreadable");
} else {
  for (const required of ["build", "lint", "test"]) {
    if (!hasScript(rootPkg, required)) {
      blocker(`script:${required}`, `Root script "${required}" is missing in package.json`);
    }
  }
  // api:check is preserved if currently configured (per spec).
  if (hasScript(rootPkg, "api:check")) {
    // present is fine; no action.
  } else {
    warn("script:api:check", "Root script 'api:check' is not configured");
  }
}

// ---------------------------------------------------------------------------
// 2. Run sub-scanners.
// ---------------------------------------------------------------------------
const noDemoOk = runChildScript("scripts/no-demo-prod-scan.mjs", "no-demo-scan");
if (!noDemoOk) {
  blocker("no-demo-prod", "Demo / hardcoded content detected in production paths");
}

const surfaceOk = runChildScript("scripts/surface-contract-scan.mjs", "surface-contract-scan");
if (!surfaceOk) {
  blocker("surface-contract", "Surface contract scan failed (see above)");
}

// ---------------------------------------------------------------------------
// 3. Report.
// ---------------------------------------------------------------------------
const blockers = findings.filter((f) => f.severity === "blocker");
const warnings = findings.filter((f) => f.severity === "warning");

if (warnings.length) {
  console.log("");
  console.log("Production readiness warnings:");
  for (const w of warnings) console.log(`  • [${w.id}] ${w.message}`);
}

if (blockers.length) {
  console.log("");
  console.log("Production readiness BLOCKERS:");
  for (const b of blockers) {
    console.log(`  ✗ [${b.id}] ${b.message}`);
    if (b.hint) console.log(`      hint: ${b.hint}`);
  }
}

const shouldFail = blockers.length > 0 && (IS_PROD || STRICT);

if (shouldFail) {
  console.log("");
  console.log(`Production readiness check FAILED (${blockers.length} blocker(s)).`);
  process.exit(1);
}

if (blockers.length) {
  console.log("");
  console.log(
    `Production readiness check found ${blockers.length} blocker(s) but NODE_ENV is "${process.env.NODE_ENV ?? ""}".`,
  );
  console.log(
    "These MUST be resolved before a production build. Re-run with NODE_ENV=production or --strict to enforce.",
  );
  process.exit(0);
}

console.log("Production readiness check passed.");
process.exit(0);
