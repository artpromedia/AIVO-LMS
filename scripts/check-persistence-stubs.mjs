#!/usr/bin/env node
// persistence:stubs — guards the memory→postgres persistence cutover.
//
// Every domain store under apps/web-v2/lib/db/persistence/drizzle/ must
// eventually be a real Drizzle implementation. While the cutover is in
// flight we track the *known-remaining* stubs in an allowlist. The gate
// fails when:
//
//   1. A NEW stub appears (a drizzle adapter contains `notImplemented(`
//      but is not in the allowlist) — stops the stub count from growing.
//   2. An allowlisted file is no longer a stub — forces whoever
//      implemented it to shrink the allowlist (so it trends to zero).
//
// Implement an adapter ⇒ delete its entry from STILL_STUBBED below.

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const DRIZZLE_DIR = join(repoRoot, "apps/web-v2/lib/db/persistence/drizzle");

// Domains still backed by an explicit `notImplemented` stub. Shrink this
// as adapters land; the goal is an empty list (then this gate flips to
// "no stubs allowed at all").
const STILL_STUBBED = new Set([
  "admin.ts",
  "assessments.ts",
  "audit.ts",
  "compliance.ts",
  "curriculum.ts",
  "identity.ts",
  "learners.ts",
  "notifications.ts",
  "quests.ts",
]);

const STUB_MARKER = /notImplemented\(/;

const files = readdirSync(DRIZZLE_DIR).filter((f) => f.endsWith(".ts"));
const actualStubs = new Set(
  files.filter((f) => STUB_MARKER.test(readFileSync(join(DRIZZLE_DIR, f), "utf8"))),
);

const errors = [];

// 1. New stubs (present on disk, not allowlisted).
for (const f of actualStubs) {
  if (!STILL_STUBBED.has(f)) {
    errors.push(
      `new persistence stub: drizzle/${f} contains notImplemented(). ` +
        `Implement it — do not add to the allowlist.`,
    );
  }
}

// 2. Allowlisted-but-implemented (stale allowlist entry).
for (const f of STILL_STUBBED) {
  if (!actualStubs.has(f)) {
    errors.push(
      `drizzle/${f} is implemented (no notImplemented) but still listed in ` +
        `STILL_STUBBED — remove it from scripts/check-persistence-stubs.mjs.`,
    );
  }
}

const remaining = actualStubs.size;
console.log(
  `persistence:stubs — ${files.length} adapters, ${remaining} still stubbed, ` +
    `${files.length - remaining} implemented.`,
);

if (errors.length) {
  for (const e of errors) console.error(`error: ${e}`);
  console.error(`\npersistence:stubs FAILED with ${errors.length} error(s).`);
  process.exit(1);
}

console.log("persistence:stubs OK — stub set matches the allowlist (no growth).");
