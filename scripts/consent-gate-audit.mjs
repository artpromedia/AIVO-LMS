#!/usr/bin/env node
// consent:audit — verifies that BFF routes which touch under-13
// learner-scoped data call requireLearnerConsent before responding.
//
// Sprint 04 ownership. The canonical list of sensitive route patterns
// lives in docs/compliance/consent-matrix.md ("BFF gates" section);
// when you add a new sensitive route pattern, update both the matrix
// and the SENSITIVE_PATTERNS table below.
//
// Behavior:
//   - Sensitive route lacks requireLearnerConsent() call → exit 1
//   - Sensitive route imports requireLearnerConsent but never calls it
//     in any HTTP handler → exit 1
//   - Allow-listed routes (consent management, public-by-design,
//     non-mutating health checks) → no requirement
//
// This is a structural scan; it does not assert that the *right* set
// of consent types is requested. That is a Sprint 04 follow-up gate.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

// path suffix => required (true) | allow-listed (false)
const SENSITIVE_PATTERNS = [
  { match: /\/learners\/\[learnerId\]\/iep-upload(\/|$)/, required: true },
  { match: /\/learners\/\[learnerId\]\/brain-profile(\/|$)/, required: true },
  { match: /\/learners\/\[learnerId\]\/parent-assessment(\/|$)/, required: true },
  { match: /\/learners\/\[learnerId\]\/baseline(\/|$)/, required: true },
  { match: /\/learners\/\[learnerId\]\/mastery(\/|$)/, required: true },
  { match: /\/learners\/\[learnerId\]\/progress(\/|$)/, required: true },
  { match: /\/learners\/\[learnerId\]\/readiness(\/|$)/, required: true },
  { match: /\/learners\/\[learnerId\]\/missions(\/|$)/, required: true },
  { match: /\/learners\/\[learnerId\]\/lesson-runs(\/|$)/, required: true },
  { match: /\/learners\/\[learnerId\]\/homework(\/|$)/, required: true },
  { match: /\/learners\/\[learnerId\]\/tts(\/|$)/, required: true },
  { match: /\/learners\/\[learnerId\]\/context(\/|$)/, required: true },
  { match: /\/learners\/\[learnerId\]\/accessibility(\/|$)/, required: true },
  { match: /\/learners\/\[learnerId\]\/audio-preferences(\/|$)/, required: true },
  { match: /\/learners\/\[learnerId\]\/learning-path(\/|$)/, required: true },
  { match: /\/learners\/\[learnerId\]\/quests(\/|$)/, required: true },
  { match: /\/learners\/\[learnerId\]\/subjects(\/|$)/, required: true },
  { match: /\/learners\/\[learnerId\]\/today(\/|$)/, required: true },
  { match: /\/learners\/\[learnerId\]\/route\.ts$/, required: true },
  // Sprint 10 — engagement (XP/badges/streaks) and tutor reply both
  // touch personalised learner data and therefore require consent.
  // Adding them here makes consent:audit reject any future sibling
  // route that ships without requireLearnerConsent.
  { match: /\/learners\/\[learnerId\]\/engagement(\/|$)/, required: true },
  { match: /\/learners\/\[learnerId\]\/tutor(\/|$)/, required: true },
  // Allow-listed — consent management routes manage themselves.
  { match: /\/learners\/\[learnerId\]\/consent(\/|$)/, required: false },
  // Top-level listing endpoint scopes by parent ownership, not consent.
  { match: /\/api\/bff\/learners\/route\.ts$/, required: false },
];

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (st.isFile()) out.push(full);
  }
  return out;
}

const bffRoot = join(repoRoot, "apps/web-v2/app/api/bff/learners");
const files = walk(bffRoot).filter((p) => p.endsWith("/route.ts"));

if (files.length === 0) {
  console.error(
    "error: no BFF learner routes found under apps/web-v2/app/api/bff/learners — consent:audit cannot verify nothing.",
  );
  process.exit(1);
}

const guardSrc = readFileSync(join(repoRoot, "apps/web-v2/lib/bff/consent-guard.ts"), "utf8");
if (!/export function requireLearnerConsent/.test(guardSrc)) {
  console.error("error: apps/web-v2/lib/bff/consent-guard.ts must export requireLearnerConsent.");
  process.exit(1);
}

const errors = [];
const warnings = [];

function classify(file) {
  const rel = file.replace(repoRoot + "/", "");
  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.match.test(rel)) return pattern;
  }
  return null;
}

for (const file of files) {
  const rel = file.replace(repoRoot + "/", "");
  const pattern = classify(file);
  if (!pattern) {
    warnings.push(`${rel}: not classified — add to SENSITIVE_PATTERNS or allow-list.`);
    continue;
  }
  if (!pattern.required) continue;
  const src = readFileSync(file, "utf8");
  const callsGuard = /requireLearnerConsent\(/.test(src) || /hasLearnerConsent\(/.test(src);
  if (!callsGuard) {
    errors.push(`${rel}: must call requireLearnerConsent() before returning a response.`);
  }
}

if (warnings.length) {
  for (const w of warnings) console.warn(`warn: ${w}`);
}
if (errors.length) {
  for (const e of errors) console.error(`error: ${e}`);
  console.error(
    `\nconsent:audit FAILED with ${errors.length} sensitive route(s) missing a consent guard.`,
  );
  process.exit(1);
}

console.log(
  `consent:audit OK — ${files.length} learner BFF route(s) scanned, ${warnings.length} unclassified.`,
);
