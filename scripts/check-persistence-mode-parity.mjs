#!/usr/bin/env node
/**
 * check-persistence-mode-parity.mjs
 *
 * Sprint 6 static guard for the assessments/brainProfiles same-mode rule.
 *
 * The clone written by submitParentAssessment / completeBaseline must land
 * in the SAME persistence backend the assessment lives in. If assessments
 * resolve to postgres but brainProfiles resolve to memory (or vice-versa),
 * the brain clone is written to a store the assessment never reaches — the
 * "brain build looks broken" failure this program fixed. The runtime warns
 * (persistence.mode_mismatch in lib/db/persistence/index.ts); this script is
 * the build-time documentation guard so the requirement can't be silently
 * dropped.
 *
 * Checks:
 *   1. lib/db/persistence/index.ts still contains the warnOnModeMismatch
 *      guard + the PERSISTENCE_MODE_PARITY_ANCHOR comment.
 *   2. apps/web-v2/.env.example documents the same-mode requirement.
 *
 * Usage: node scripts/check-persistence-mode-parity.mjs
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const INDEX = "apps/web-v2/lib/db/persistence/index.ts";
const ENV_EXAMPLE = "apps/web-v2/.env.example";

const failures = [];

function read(rel) {
  try {
    return readFileSync(join(ROOT, rel), "utf8");
  } catch {
    failures.push(`${rel}: file not found`);
    return "";
  }
}

const indexSrc = read(INDEX);
if (!/PERSISTENCE_MODE_PARITY_ANCHOR/.test(indexSrc)) {
  failures.push(`${INDEX}: missing PERSISTENCE_MODE_PARITY_ANCHOR comment`);
}
if (!/warnOnModeMismatch\s*\(/.test(indexSrc)) {
  failures.push(`${INDEX}: missing warnOnModeMismatch guard`);
}
if (!/persistence\.mode_mismatch/.test(indexSrc)) {
  failures.push(`${INDEX}: missing persistence.mode_mismatch warning event`);
}

const envSrc = read(ENV_EXAMPLE);
// The .env.example must mention that assessments + brainProfiles share a mode.
if (!/assessments\s+and\s+brainProfiles\s+MUST\s+share\s+a\s+mode/i.test(envSrc)) {
  failures.push(
    `${ENV_EXAMPLE}: missing the documented "assessments and brainProfiles MUST share a mode" note`,
  );
}

if (failures.length > 0) {
  console.error("✖ persistence mode-parity documentation guard failed:");
  for (const f of failures) console.error(`  - ${f}`);
  console.error(
    "\nThe assessments/brainProfiles same-mode requirement must stay documented " +
      "in code + .env.example. Restore the anchor/guard/note above.",
  );
  process.exit(1);
}

console.log("✓ persistence mode-parity guard + documentation present");
