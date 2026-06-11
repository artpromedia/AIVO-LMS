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
import { dirname, join, resolve, sep } from "node:path";
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
// Use path.basename so the filter is correct on both POSIX and Windows
// (walk() returns paths with the host separator; an `endsWith("/route.ts")`
// check silently matched nothing on Windows). The guard is not weakened —
// the route-file recognition is what was platform-broken.
const files = walk(bffRoot).filter((p) => p.endsWith(`${sep}route.ts`) || p.endsWith("/route.ts"));

if (files.length === 0) {
  console.error(
    "error: no BFF learner routes found under apps/web-v2/app/api/bff/learners — consent:audit cannot verify nothing.",
  );
  process.exit(1);
}

const guardSrc = readFileSync(join(repoRoot, "apps/web-v2/lib/bff/consent-guard.ts"), "utf8");
if (!/export (?:async )?function requireLearnerConsent/.test(guardSrc)) {
  console.error("error: apps/web-v2/lib/bff/consent-guard.ts must export requireLearnerConsent.");
  process.exit(1);
}

const errors = [];
const warnings = [];

function classify(file) {
  // Normalise to POSIX-style separators so SENSITIVE_PATTERNS regexes
  // (authored with `/`) match on Windows too.
  const rel = file
    .replace(repoRoot + sep, "")
    .split(sep)
    .join("/");
  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.match.test(rel)) return pattern;
  }
  return null;
}

for (const file of files) {
  const rel = file
    .replace(repoRoot + sep, "")
    .split(sep)
    .join("/");
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

// ── Sprint A6 — explicit age collection feeds the consent regime ───────────
// COPPA's under-13 determination is only as good as the age data collected
// at learner creation. Pin: (a) BOTH mobile parent creation flows collect
// dateOfBirth and validate it, (b) identity-svc persists dateOfBirth and
// derives requiresParentConsent fail-closed, (c) the web add-learner form
// requires ageRange, whose recordAgeGate default stays fail-closed.
{
  const required = [
    [
      "apps/mobile/app/(parent)/learner-new/index.tsx",
      [/validateBirthDate/, /dateOfBirth:\s*birthDate/],
    ],
    ["apps/mobile/app/(parent)/onboard.tsx", [/validateBirthDate/, /dateOfBirth/]],
    ["apps/mobile/lib/birth-date.ts", [/isUnder13/, /return true; \/\/ fail closed/]],
    [
      "services/identity-svc/src/routes/users.ts",
      [/requiresParentConsent/, /dateOfBirth\b/],
    ],
    ["apps/web-v2/app/parent/learners/new/page.tsx", [/name="ageRange"\s*\n\s*required/]],
    ["apps/web-v2/lib/db/repos.ts", [/requiresParentConsent: input\.ageRange \? UNDER_13_AGE_RANGES\.has\(input\.ageRange\) : true/]],
  ];
  for (const [rel, patterns] of required) {
    const abs = join(repoRoot, rel);
    if (!existsSync(abs)) {
      errors.push(`${rel}: age-gate file missing (Sprint A6 contract).`);
      continue;
    }
    const src = readFileSync(abs, "utf8");
    for (const pattern of patterns) {
      if (!pattern.test(src)) {
        errors.push(`${rel}: missing age-gate marker ${pattern}`);
      }
    }
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
