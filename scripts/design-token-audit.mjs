#!/usr/bin/env node
/**
 * design-token:audit — Sprint B7 ratchet.
 *
 * Raw hex color literals in the shared UI packages bypass the design
 * token source (packages/brand/tokens/*.json → generated outputs) and
 * are how the four theme implementations drifted apart. This gate:
 *
 *   1. counts hex literals per file across packages/{ui,learner-ui,
 *      admin-ui,mobile-ui,stage-ui}/src (comments stripped; *.test.* and
 *      generated outputs excluded);
 *   2. fails on ANY file not in scripts/design-token-allowlist.json and
 *      on any count above its allowlisted baseline — new raw colors are
 *      impossible to add;
 *   3. fails when a file IMPROVES below its baseline until the baseline
 *      is re-tightened (`--update`), so wins are locked in and the
 *      register only ratchets DOWN.
 *
 * The allowlist is the migration-debt register for the DTCG
 * consolidation: tier themes were consolidated in B7 itself; everything
 * still listed is pending migration and tracked file-by-file.
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const allowlistPath = join(repoRoot, "scripts/design-token-allowlist.json");
const PACKAGES = ["ui", "learner-ui", "admin-ui", "mobile-ui", "stage-ui"];
const HEX = /#[0-9a-fA-F]{3,8}\b/g;

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    const st = statSync(abs);
    if (st.isDirectory()) {
      if (entry === "node_modules" || entry === "dist" || entry === "generated") continue;
      yield* walk(abs);
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.(test|spec)\./.test(entry)) {
      yield abs;
    }
  }
}

const counts = new Map();
for (const pkg of PACKAGES) {
  const srcDir = join(repoRoot, "packages", pkg, "src");
  if (!existsSync(srcDir)) continue;
  for (const abs of walk(srcDir)) {
    const matches = stripComments(readFileSync(abs, "utf8")).match(HEX);
    if (matches?.length) counts.set(relative(repoRoot, abs).replaceAll("\\", "/"), matches.length);
  }
}

if (process.argv.includes("--update")) {
  const existing = existsSync(allowlistPath)
    ? JSON.parse(readFileSync(allowlistPath, "utf8"))
    : { files: {} };
  const files = {};
  for (const [file, count] of [...counts.entries()].sort()) {
    files[file] = { count, note: existing.files?.[file]?.note ?? "pending DTCG migration" };
  }
  writeFileSync(
    allowlistPath,
    JSON.stringify(
      {
        comment:
          "Sprint B7 migration-debt register: every raw hex literal left in the shared UI packages, file by file. Counts can only go DOWN — the audit fails on any new file or increased count, and on decreases until this baseline is re-tightened with --update. Tier themes already consolidated into packages/brand/tokens/modes/tier-themes.json; files below are the remaining migration queue.",
        files,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`design-token:audit wrote ${Object.keys(files).length} file baselines.`);
  process.exit(0);
}

if (!existsSync(allowlistPath)) {
  console.error("design-token:audit: allowlist missing — run with --update once and commit it.");
  process.exit(1);
}
const allowlist = JSON.parse(readFileSync(allowlistPath, "utf8"));
const errors = [];
const improvements = [];

for (const [file, count] of counts.entries()) {
  const entry = allowlist.files[file];
  if (!entry) {
    errors.push(`${file}: ${count} raw hex literal(s) in a NEW file — use @aivo/brand tokens instead`);
  } else if (count > entry.count) {
    errors.push(`${file}: ${count} raw hex literal(s), baseline allows ${entry.count} — use @aivo/brand tokens`);
  } else if (count < entry.count) {
    improvements.push(`${file}: ${count} < baseline ${entry.count}`);
  }
}
for (const file of Object.keys(allowlist.files)) {
  if (!counts.has(file)) improvements.push(`${file}: now clean (baseline ${allowlist.files[file].count})`);
}

if (improvements.length) {
  errors.push(
    `baseline is stale — these files improved; lock the win in with \`node scripts/design-token-audit.mjs --update\`:\n    ${improvements.join("\n    ")}`,
  );
}

if (errors.length) {
  console.error(`design-token:audit FAILED (${errors.length} problem(s)):`);
  for (const err of errors) console.error(`  ✗ ${err}`);
  process.exit(1);
}
const total = [...counts.values()].reduce((a, b) => a + b, 0);
console.log(
  `design-token:audit OK — ${total} allowlisted hex literal(s) across ${counts.size} file(s); none added, ratchet only goes down.`,
);
