#!/usr/bin/env node
/**
 * web-v2 bundle budgets (Sprint B7).
 *
 * Reads the Next.js app build manifest and computes first-load JS (raw
 * bytes of the unique chunk set a route ships) per ROUTE GROUP — the
 * shared root layout baseline plus each top-level segment (/learner,
 * /parent, /login, …). Fails when any group exceeds its budget in
 * scripts/ci/bundle-budgets.json (seeded from the measured baseline
 * +10% headroom).
 *
 * Raw (uncompressed) bytes on purpose: they are deterministic across
 * runners, while gzip sizes vary with the zlib build. Budgets and
 * measurements use the same metric so the ratchet is apples-to-apples.
 *
 *   node scripts/ci/bundle-budget.mjs            # enforce
 *   node scripts/ci/bundle-budget.mjs --update   # reseed budgets (+10%)
 */
import { readFileSync, writeFileSync, statSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const nextDir = join(repoRoot, "apps/web-v2/.next");
const budgetsPath = join(repoRoot, "scripts/ci/bundle-budgets.json");
const manifestPath = join(nextDir, "app-build-manifest.json");

if (!existsSync(manifestPath)) {
  console.error(`bundle-budget: ${manifestPath} not found — build apps/web-v2 first.`);
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

function bytesOf(file) {
  const full = join(nextDir, file);
  try {
    return statSync(full).size;
  } catch {
    return 0; // CSS/map listed but absent — never counted twice anyway
  }
}

/** First-load bytes for one route = unique JS files incl. shared layout. */
function firstLoadBytes(files) {
  const js = [...new Set(files)].filter((f) => f.endsWith(".js"));
  return js.reduce((sum, f) => sum + bytesOf(f), 0);
}

function groupOf(route) {
  // "/parent/learners/[learnerId]/page" → "/parent"; "/page" → "/"
  const seg = route.replace(/\/page$/, "").split("/").filter(Boolean)[0];
  return seg ? `/${seg}` : "/";
}

const groups = new Map(); // group → { maxBytes, worstRoute }
const sharedFiles = manifest.pages["/layout"] ?? [];
const sharedBytes = firstLoadBytes(sharedFiles);

for (const [route, files] of Object.entries(manifest.pages)) {
  if (!route.endsWith("/page")) continue; // layouts/api routes aren't pages
  if (route.startsWith("/api/")) continue;
  const total = firstLoadBytes([...sharedFiles, ...files]);
  const group = groupOf(route);
  const current = groups.get(group);
  if (!current || total > current.maxBytes) {
    groups.set(group, { maxBytes: total, worstRoute: route });
  }
}

const measured = {
  sharedBaseline: sharedBytes,
  groups: Object.fromEntries(
    [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([group, info]) => [group, info.maxBytes]),
  ),
};

if (process.argv.includes("--update")) {
  const HEADROOM = 1.1;
  const budgets = {
    comment:
      "Sprint B7 — first-load JS budgets (raw bytes) per route group, measured baseline +10% headroom. Regenerate deliberately with `node scripts/ci/bundle-budget.mjs --update` and justify the bump in the PR.",
    sharedBaseline: Math.ceil(sharedBytes * HEADROOM),
    groups: Object.fromEntries(
      Object.entries(measured.groups).map(([group, bytes]) => [group, Math.ceil(bytes * HEADROOM)]),
    ),
  };
  writeFileSync(budgetsPath, JSON.stringify(budgets, null, 2) + "\n");
  console.log(`bundle-budget: wrote ${budgetsPath} from measured baseline (+10%).`);
  process.exit(0);
}

if (!existsSync(budgetsPath)) {
  console.error("bundle-budget: budgets file missing — run with --update once and commit it.");
  process.exit(1);
}
const budgets = JSON.parse(readFileSync(budgetsPath, "utf8"));

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} kB`;
const failures = [];

if (measured.sharedBaseline > budgets.sharedBaseline) {
  failures.push(
    `shared baseline ${kb(measured.sharedBaseline)} exceeds budget ${kb(budgets.sharedBaseline)}`,
  );
}
for (const [group, bytes] of Object.entries(measured.groups)) {
  const budget = budgets.groups[group];
  if (budget === undefined) {
    failures.push(
      `route group ${group} (${kb(bytes)}, worst: ${groups.get(group).worstRoute}) has NO budget — add it deliberately via --update`,
    );
  } else if (bytes > budget) {
    failures.push(
      `route group ${group} first-load ${kb(bytes)} exceeds budget ${kb(budget)} (worst: ${groups.get(group).worstRoute})`,
    );
  }
}

console.log(`bundle-budget: shared baseline ${kb(measured.sharedBaseline)} (budget ${kb(budgets.sharedBaseline)})`);
for (const [group, bytes] of Object.entries(measured.groups)) {
  const budget = budgets.groups[group];
  console.log(`  ${group.padEnd(20)} ${kb(bytes).padStart(10)} / ${budget !== undefined ? kb(budget) : "NO BUDGET"}`);
}

if (failures.length) {
  console.error(`\nbundle-budget FAILED (${failures.length}):`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log("bundle-budget OK — every route group within budget.");
