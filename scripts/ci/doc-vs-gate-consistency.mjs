#!/usr/bin/env node
/**
 * doc-vs-gate-consistency.mjs
 *
 * Fails CI if any markdown doc claims a gate is "green/passing/done" when the
 * gate manifest (scripts/ci/gate-manifest.json) says otherwise, OR if a gate
 * marked claimed_status=green in the manifest actually exits non-zero when
 * re-run with `--verify`.
 *
 * This exists because this repo has, historically, shipped "production-ready"
 * documentation while `release:gate` was RED. Aspirational docs are how you
 * get an enterprise outage on day one.
 *
 * Modes:
 *   default                Scan-only: parse docs, compare against manifest.
 *                          Exit 1 if any claim contradicts manifest truth.
 *
 *   --verify               After scanning, RE-RUN every gate that the manifest
 *                          claims is "green" and verify the command exits 0.
 *                          A green-claimed gate that now fails is a hard
 *                          failure (exit 2). This is the trustworthy mode
 *                          for the release captain.
 *
 *   --update-manifest      Used only by the explicit "refresh gate truth"
 *                          workflow: run every gate (including unverified)
 *                          and rewrite claimed_status in the manifest. NEVER
 *                          run this automatically — it disarms the gate.
 *
 *   --json                 Machine-readable output.
 *
 * Exit codes:
 *   0  consistent
 *   1  doc claim contradicts manifest
 *   2  --verify: a green-claimed gate actually fails
 *   3  --update-manifest succeeded with at least one gate failure (info)
 *   4  invalid invocation
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { globSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");
const manifestPath = resolve(here, "gate-manifest.json");

function parseArgs(argv) {
  const a = {
    verify: false,
    updateManifest: false,
    updateAllowlist: false,
    json: false,
  };
  for (const x of argv) {
    if (x === "--verify") a.verify = true;
    else if (x === "--update-manifest") a.updateManifest = true;
    else if (x === "--update-allowlist") a.updateAllowlist = true;
    else if (x === "--json") a.json = true;
    else {
      console.error(`unknown flag: ${x}`);
      process.exit(4);
    }
  }
  return a;
}
const args = parseArgs(process.argv.slice(2));

if (!existsSync(manifestPath)) {
  console.error(`gate manifest not found: ${manifestPath}`);
  process.exit(4);
}
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const gateById = new Map(manifest.gates.map((g) => [g.id, g]));
const claimWords = (manifest.policy?.claimWords ?? []).map((w) => w.toLowerCase());
const failureWords = (manifest.policy?.failureWords ?? []).map((w) => w.toLowerCase());
const scanGlobs = manifest.policy?.scanGlobs ?? [];

// Allowlist of pre-existing doc claims tolerated as historical/aspirational
// context. NEW violations beyond this list fail the build. Each entry is
// "<file>:<gateId>" — line numbers shift too easily to pin to. Use
// `--update-allowlist` to ratchet (only when you've intentionally cleaned
// up the docs, never to silence a real regression).
const allowlistPath = resolve(here, "gate-doc-allowlist.json");
let allowlist = { generatedAt: null, entries: [] };
if (existsSync(allowlistPath)) {
  allowlist = JSON.parse(readFileSync(allowlistPath, "utf8"));
}
const allowlistSet = new Set(allowlist.entries ?? []);
function allowlistKey(file, gateId) {
  return `${file.replace(/\\/g, "/")}::${gateId}`;
}

// --- Scan docs ------------------------------------------------------------
// We look for `<gate-id>` (in code spans or plain text) on a line that also
// contains a claim word. A "green claim" means a claim word; a "red claim"
// means a failure word. The manifest truth is `claimed_status`.

function* iterDocFiles() {
  const seen = new Set();
  for (const g of scanGlobs) {
    const matches = globSync(g, { cwd: repoRoot, nodir: true });
    for (const m of matches) {
      const abs = resolve(repoRoot, m);
      if (seen.has(abs)) continue;
      seen.add(abs);
      yield { rel: m, abs };
    }
  }
}

function scanFile({ rel, abs }) {
  const text = readFileSync(abs, "utf8");
  const lines = text.split(/\r?\n/);
  const findings = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lower = line.toLowerCase();
    const hasGreenClaim = claimWords.some((w) => new RegExp(`\\b${w}\\b`).test(lower));
    const hasRedClaim = failureWords.some((w) => new RegExp(`\\b${w}\\b`).test(lower));
    if (!hasGreenClaim && !hasRedClaim) continue;
    for (const g of manifest.gates) {
      // Single-word generic IDs ("test", "build", "lint") cause too many
      // false positives in prose ("test green", "lint green"); for those we
      // require the ID to appear inside backticks. Compound IDs with a colon
      // or dot (e.g. `i18n:audit`, `release:gate`) are unambiguous and can
      // match bare or inside backticks.
      const isCompound = /[.:]/.test(g.id);
      const escaped = g.id.replace(/[.:*+?^${}()|[\]\\]/g, "\\$&");
      const re = isCompound
        ? new RegExp(`(?:^|[^A-Za-z0-9_])\`?${escaped}\`?(?![A-Za-z0-9_])`)
        : new RegExp("`" + escaped + "`");
      if (!re.test(line)) continue;
      findings.push({
        file: rel,
        line: i + 1,
        gateId: g.id,
        claimedGreen: hasGreenClaim,
        claimedRed: hasRedClaim,
        snippet: line.trim().slice(0, 160),
      });
    }
  }
  return findings;
}

const allFindings = [];
for (const f of iterDocFiles()) {
  allFindings.push(...scanFile(f));
}

const violations = [];
const allowedHistorical = [];
for (const f of allFindings) {
  const truth = gateById.get(f.gateId).claimed_status;
  let kind = null;
  if (f.claimedGreen && truth !== "green") {
    kind = "doc-claims-green-but-manifest-says";
  } else if (f.claimedRed && truth === "green") {
    kind = "doc-claims-red-but-manifest-says-green";
  }
  if (!kind) continue;
  const entry = {
    ...f,
    kind,
    manifestStatus: truth,
    allowlistKey: allowlistKey(f.file, f.gateId),
  };
  if (allowlistSet.has(entry.allowlistKey)) {
    allowedHistorical.push(entry);
  } else {
    violations.push(entry);
  }
}

if (args.updateAllowlist) {
  // Capture the full set of CURRENT findings as allowlist. Only run when you
  // intentionally accept the docs as-is.
  const next = {
    generatedAt: new Date().toISOString(),
    description:
      "Pre-existing (file, gateId) pairs where a doc makes a claim that doesn't match the gate manifest. New violations beyond this list fail CI. Ratchet down by fixing docs and re-running with --update-allowlist.",
    entries: [...new Set([...violations, ...allowedHistorical].map((v) => v.allowlistKey))].sort(),
  };
  writeFileSync(allowlistPath, JSON.stringify(next, null, 2) + "\n");
  console.error(`updated doc allowlist → ${allowlistPath}`);
}

// --- Verify mode: re-run green-claimed gates ------------------------------

const verifyResults = [];
if (args.verify || args.updateManifest) {
  for (const g of manifest.gates) {
    if (!args.updateManifest && g.claimed_status !== "green") continue;
    const [cmd, ...rest] = g.command.split(/\s+/);
    const res = spawnSync(cmd, rest, {
      cwd: repoRoot,
      stdio: "inherit",
      shell: true,
      env: process.env,
    });
    verifyResults.push({
      id: g.id,
      command: g.command,
      exitCode: res.status,
      ok: res.status === 0,
      previousClaim: g.claimed_status,
    });
    if (args.updateManifest) {
      g.claimed_status = res.status === 0 ? "green" : "red";
    }
  }
  if (args.updateManifest) {
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  }
}

// --- Report ---------------------------------------------------------------

if (args.json) {
  process.stdout.write(
    JSON.stringify(
      {
        manifestPath,
        findings: allFindings,
        violations,
        verifyResults,
      },
      null,
      2,
    ) + "\n",
  );
} else {
  const lines = [];
  lines.push("doc-vs-gate consistency report");
  lines.push("================================");
  lines.push(`manifest: ${manifestPath}`);
  lines.push(`scanned files: ${[...iterDocFiles()].map((f) => f.rel).join(", ") || "(none)"}`);
  lines.push("");
  lines.push(`claim findings: ${allFindings.length}`);
  lines.push(`allowlisted pre-existing: ${allowedHistorical.length}`);
  if (violations.length === 0) {
    lines.push("violations: 0 — docs and manifest agree (within allowlist).");
  } else {
    lines.push(`violations: ${violations.length}`);
    for (const v of violations) {
      lines.push(`  ${v.file}:${v.line}  gate=${v.gateId}  ${v.kind}=${v.manifestStatus}`);
      lines.push(`    > ${v.snippet}`);
    }
    lines.push("");
    lines.push(
      "→ Fix the doc OR run `node scripts/ci/doc-vs-gate-consistency.mjs --update-allowlist` if accepting historically.",
    );
  }
  if (verifyResults.length > 0) {
    lines.push("");
    lines.push(`verify results: ${verifyResults.length}`);
    const failed = verifyResults.filter((r) => !r.ok);
    for (const r of verifyResults) {
      lines.push(
        `  ${r.ok ? "PASS" : "FAIL"}  ${r.id.padEnd(40)}  exit=${r.exitCode}  ${r.command}`,
      );
    }
    if (failed.length > 0) {
      lines.push("");
      lines.push(
        `${failed.length} gate(s) claimed "green" in the manifest but exited non-zero on re-run.`,
      );
    }
  }
  process.stdout.write(lines.join("\n") + "\n");
}

const verifyFailures = verifyResults.filter((r) => !r.ok && r.previousClaim === "green");

if (violations.length > 0) process.exit(1);
if (args.verify && verifyFailures.length > 0) process.exit(2);
if (args.updateManifest && verifyResults.some((r) => !r.ok)) process.exit(3);
process.exit(0);
