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

const productionGapOk = runChildScript("scripts/production-gap-gate.mjs", "production-gap-gate");
if (!productionGapOk) {
  blocker("production-gaps", "Required durable, fail-closed, or tutor coverage floors regressed");
}

// ---------------------------------------------------------------------------
// 2a. Sprint 12.7 — env manifest gate.
// Flags:
//   - any var in .env.example missing from the live env
//   - any var matching placeholder patterns (change-me, your-key-here, …)
//   - groups in scripts/env/required-prod-vars.json missing required vars
// ---------------------------------------------------------------------------
const manifestPath = resolve(REPO_ROOT, "scripts/env/required-prod-vars.json");
let manifest = null;
if (existsSync(manifestPath)) {
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (err) {
    warn("env:manifest-parse", `Could not parse required-prod-vars.json: ${err.message}`);
  }
}

const envExamplePath = resolve(REPO_ROOT, ".env.example");
const envExampleVars = new Set();
if (existsSync(envExamplePath)) {
  const lines = readFileSync(envExamplePath, "utf8").split("\n");
  for (const line of lines) {
    const m = line.match(/^([A-Z][A-Z0-9_]*)=/);
    if (m) envExampleVars.add(m[1]);
  }
}

const placeholderPatterns = (manifest?.placeholderPatterns ?? []).map(
  (p) => new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
);

if (IS_PROD || STRICT) {
  // Only enforce env-manifest checks when running against a real prod env.
  // In dev a contributor will routinely have placeholder values; we don't
  // want every developer's first pnpm prod:check run to fail.
  for (const name of envExampleVars) {
    const v = process.env[name];
    if (v === undefined || v === "") continue; // unset is handled per-group
    for (const pat of placeholderPatterns) {
      if (pat.test(v)) {
        blocker(`env:placeholder:${name}`, `${name} matches placeholder pattern ${pat}`);
      }
    }
  }

  if (manifest?.groups) {
    for (const [groupName, group] of Object.entries(manifest.groups)) {
      for (const v of group.required ?? []) {
        if (!process.env[v]) {
          blocker(
            `env:missing:${v}`,
            `Required production env var ${v} (${groupName}) is unset`,
            `See scripts/env/required-prod-vars.json group="${groupName}".`,
          );
        }
      }
      for (const [v, min] of Object.entries(group.minLength ?? {})) {
        if (process.env[v] && process.env[v].length < min) {
          blocker(`env:short:${v}`, `${v} must be at least ${min} chars in production`);
        }
      }
      // Value gates — presence alone is not safety. Catches the cases the
      // runtime guards refuse (e.g. AIVO_PERSISTENCE=memory, AUTH_MODE=mock,
      // AI_PROVIDER=mock) so a deploy fails BEFORE traffic, not at first
      // request. Unset values are handled by the `required` check above.
      for (const [v, rule] of Object.entries(group.values ?? {})) {
        const val = process.env[v];
        if (val === undefined || val === "") continue;
        if (rule.equals !== undefined && val !== rule.equals) {
          blocker(
            `env:value:${v}`,
            `${v} must equal "${rule.equals}" in production (got "${val}")`,
            `See scripts/env/required-prod-vars.json group="${groupName}".`,
          );
        }
        if (Array.isArray(rule.oneOf) && !rule.oneOf.includes(val)) {
          blocker(
            `env:value:${v}`,
            `${v} must be one of [${rule.oneOf.join(", ")}] in production (got "${val}")`,
            `See scripts/env/required-prod-vars.json group="${groupName}".`,
          );
        }
        if (Array.isArray(rule.notOneOf) && rule.notOneOf.includes(val)) {
          blocker(
            `env:value:${v}`,
            `${v} must NOT be "${val}" in production (forbidden: [${rule.notOneOf.join(", ")}])`,
            `See scripts/env/required-prod-vars.json group="${groupName}".`,
          );
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 2b. Optional /health partial-failure scan. Set HEALTH_CHECK_URLS to a
// comma-separated list of base URLs to enable.
// ---------------------------------------------------------------------------
async function runHealthScan() {
  const urls = (process.env.HEALTH_CHECK_URLS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!urls.length) return;
  for (const base of urls) {
    try {
      const res = await fetch(`${base.replace(/\/$/, "")}/health`);
      if (!res.ok) {
        blocker(`health:${base}`, `Health check returned ${res.status}`);
        continue;
      }
      const body = await res.json().catch(() => null);
      if (body && body.status && body.status !== "healthy" && body.status !== "ok") {
        // Partial failures — body usually carries `{status:"degraded", checks:{...}}`.
        blocker(
          `health:partial:${base}`,
          `Service reports degraded status: ${JSON.stringify(body)}`,
        );
      }
    } catch (err) {
      blocker(`health:err:${base}`, `Health check failed: ${err.message}`);
    }
  }
}
await runHealthScan();

// ---------------------------------------------------------------------------
// 3. Report.
// ---------------------------------------------------------------------------

// ── Remediation Sprint 11: syllabus/pacing/holiday live dependencies ────────
// Full-term syllabus alignment, weekly pacing, and the summer-bridge holiday
// path run through brain-svc behind the shared INTERNAL_SERVICE_TOKEN. They
// fail closed without it (by design), which in production means three
// HEADLINE features silently do nothing — that is a deploy blocker, not a
// preference.
if (IS_PROD || STRICT) {
  if (!process.env.INTERNAL_SERVICE_TOKEN) {
    blocker(
      "live-deps-internal-token",
      "INTERNAL_SERVICE_TOKEN is unset — term-syllabus auto-pacing, weekly pacing reads, the summer bridge, and the Creator's internal route all fail closed without it.",
      "Set INTERNAL_SERVICE_TOKEN (shared service-to-service secret) on web-v2 AND the calling services (admin-svc Creator, brain-svc clients).",
    );
  }
  if (!process.env.BRAIN_SVC_URL) {
    blocker(
      "live-deps-brain-svc",
      "BRAIN_SVC_URL is unset — pacing-plan generation and the holiday/summer-bridge path have no upstream.",
      "Point BRAIN_SVC_URL at the deployed brain-svc (see HETZNER_DEPLOYMENT_GUIDE.md / docs runbooks).",
    );
  }
}

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
