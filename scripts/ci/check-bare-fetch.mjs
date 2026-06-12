#!/usr/bin/env node
/**
 * check-bare-fetch — ratchet gate for client-side data discipline (Sprint 08).
 *
 * Client components must reach the BFF through lib/api/client.ts (bffFetch)
 * or a TanStack Query hook built on it — never bare `fetch(`, which returns
 * `{}` on error and taught the codebase to swallow failures.
 *
 * Counts `fetch(` occurrences in files under apps/web-v2/{app,components}
 * whose source contains the "use client" directive, excluding the sanctioned
 * transport modules, the offline outbox, and tests. Fails when the count
 * EXCEEDS the recorded budget; lowering the budget after migrations is the
 * expected ritual (numbers only go down).
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const budgetPath = join(repoRoot, "scripts", "ci", "bare-fetch-budget.json");
const budget = JSON.parse(readFileSync(budgetPath, "utf8"));

const ALLOW = [
  /lib\/api\/client\.ts$/,
  /lib\/offline\/outbox\.ts$/,
  /\.test\.[jt]sx?$/,
  /__tests__\//,
  /\/e2e\//,
];

let files = [];
try {
  files = execFileSync(
    "grep",
    ["-rl", "--include=*.tsx", "--include=*.ts", '"use client"',
      join(repoRoot, "apps/web-v2/app"), join(repoRoot, "apps/web-v2/components"),
      join(repoRoot, "apps/web-v2/lib")],
    { encoding: "utf8" },
  ).split("\n").filter(Boolean);
} catch {
  files = [];
}

let total = 0;
const offenders = [];
for (const file of files) {
  const rel = file.replace(repoRoot + "/", "");
  if (ALLOW.some((re) => re.test(rel))) continue;
  const src = readFileSync(file, "utf8");
  // fetch( calls — excluding bffFetch( and property access like page.request.fetch
  const count = (src.match(/(?<![.\w])fetch\(/g) ?? []).length;
  if (count > 0) {
    total += count;
    offenders.push(`${rel}: ${count}`);
  }
}

console.log(`bare fetch( in client components: ${total} (budget ${budget.maxBareFetchCalls})`);
for (const o of offenders) console.log("  - " + o);

if (total > budget.maxBareFetchCalls) {
  console.error(
    `\ncheck-bare-fetch FAILED: ${total} > budget ${budget.maxBareFetchCalls}. ` +
      "Route new client calls through lib/api/client.ts (bffFetch) or a Query hook.",
  );
  process.exit(1);
}
if (total < budget.maxBareFetchCalls) {
  console.log(
    `\nNOTE: count (${total}) is below budget (${budget.maxBareFetchCalls}) — ` +
      "ratchet it down in scripts/ci/bare-fetch-budget.json.",
  );
}
console.log("check-bare-fetch OK");
