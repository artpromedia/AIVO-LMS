#!/usr/bin/env node
// onboarding:audit — Sprint 06 gate.
//
// Walks the readiness state machine declared in
// apps/web-v2/lib/learner/readiness.ts and verifies:
//
// 1. Every ReadinessState is listed in READINESS_LABEL,
//    READINESS_TONE, and READINESS_NEXT_STEP.
// 2. Every hrefTemplate in READINESS_NEXT_STEP resolves to a real
//    page.tsx under apps/web-v2/app/.
// 3. Every onboarding step page declared in
//    docs/onboarding/parent-journey.md exists on disk.
// 4. Every onboarding BFF endpoint exists.
//
// This is a structural scan; behavioral assertions live in
// apps/web-v2's vitest suite.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

const errors = [];

// --- Parse ReadinessState union, three lookup tables, and the BFF/page
//     contract from source ----------------------------------------------

const typesPath = join(repoRoot, "apps/web-v2/lib/db/types.ts");
const readinessPath = join(repoRoot, "apps/web-v2/lib/learner/readiness.ts");

if (!existsSync(typesPath) || !existsSync(readinessPath)) {
  errors.push("apps/web-v2/lib/db/types.ts or learner/readiness.ts missing.");
} else {
  const typesSrc = readFileSync(typesPath, "utf8");
  const readinessSrc = readFileSync(readinessPath, "utf8");

  const unionMatch = typesSrc.match(/export type ReadinessState\s*=\s*([\s\S]*?);/);
  const states = unionMatch ? [...unionMatch[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]) : [];

  if (states.length === 0) {
    errors.push("Could not parse ReadinessState union.");
  }

  function extractTableKeys(label) {
    const m = readinessSrc.match(
      new RegExp(`export const ${label}[^=]*=\\s*\\{([\\s\\S]*?)\\n\\s*\\};`),
    );
    if (!m) return null;
    // Only top-level keys (those at the start of a line, after the
    // table's opening brace). Avoid matching nested object keys like
    // `label:` and `hrefTemplate:` inside Record<,{}> values.
    const body = m[1];
    const keys = new Set();
    // Indent depth varies with prettier wrapping (2 or 4 spaces depending
    // on whether the type annotation forced a line break before the
    // opening brace). Match any indented top-level key, but reject lines
    // that look like nested object content (those typically have a value
    // pattern other than a snake_case identifier, e.g. `label:` or
    // `hrefTemplate:`, which are already covered by the dedicated
    // hrefTemplate scan below).
    const nestedValueKeys = new Set(["label", "hrefTemplate"]);
    for (const line of body.split("\n")) {
      const km = line.match(/^\s+(\w+):/);
      if (km && !nestedValueKeys.has(km[1])) keys.add(km[1]);
    }
    return [...keys];
  }

  for (const tableName of ["READINESS_LABEL", "READINESS_TONE", "READINESS_NEXT_STEP"]) {
    const keys = extractTableKeys(tableName);
    if (!keys) {
      errors.push(`learner/readiness.ts: ${tableName} not found.`);
      continue;
    }
    for (const state of states) {
      if (!keys.includes(state)) {
        errors.push(`${tableName} is missing entry for "${state}".`);
      }
    }
    for (const key of keys) {
      if (!states.includes(key)) {
        errors.push(`${tableName} has "${key}" which is not in ReadinessState — drift.`);
      }
    }
  }

  // For NEXT_STEP entries, resolve each hrefTemplate to a page.tsx.
  const nextStepBlock = readinessSrc.match(
    /export const READINESS_NEXT_STEP[^=]*=\s*\{([\s\S]*?)\n\s*\};/,
  );
  if (nextStepBlock) {
    const hrefRe = /hrefTemplate:\s*"([^"]+)"/g;
    for (const m of nextStepBlock[1].matchAll(hrefRe)) {
      const tpl = m[1];
      // Replace {learnerId} with the [learnerId] folder name.
      const route = tpl.replace(/\{learnerId\}/g, "[learnerId]").replace(/\?.*$/, "");
      const rel = `apps/web-v2/app${route}/page.tsx`;
      if (!existsSync(join(repoRoot, rel))) {
        errors.push(
          `READINESS_NEXT_STEP hrefTemplate "${tpl}" has no backing page.tsx (expected ${rel}).`,
        );
      }
    }
  }
}

// --- Required onboarding pages per parent-journey.md ----------------------

const REQUIRED_PAGES = [
  "apps/web-v2/app/signup/page.tsx",
  "apps/web-v2/app/login/page.tsx",
  "apps/web-v2/app/parent/consent/page.tsx",
  "apps/web-v2/app/parent/learners/page.tsx",
  "apps/web-v2/app/parent/learners/new/page.tsx",
  "apps/web-v2/app/parent/learners/[learnerId]/page.tsx",
  "apps/web-v2/app/parent/learners/[learnerId]/assessment/page.tsx",
  "apps/web-v2/app/parent/learners/[learnerId]/assessment/review/page.tsx",
  "apps/web-v2/app/parent/learners/[learnerId]/iep/page.tsx",
  "apps/web-v2/app/parent/learners/[learnerId]/iep/review/page.tsx",
  "apps/web-v2/app/parent/learners/[learnerId]/brain-profile/page.tsx",
  "apps/web-v2/app/parent/learners/[learnerId]/baseline/page.tsx",
];

for (const rel of REQUIRED_PAGES) {
  if (!existsSync(join(repoRoot, rel))) {
    errors.push(`missing onboarding page: ${rel}`);
  }
}

// --- Required onboarding BFF endpoints ------------------------------------

const REQUIRED_BFF = [
  "apps/web-v2/app/api/bff/learners/route.ts",
  "apps/web-v2/app/api/bff/learners/[learnerId]/route.ts",
  "apps/web-v2/app/api/bff/learners/[learnerId]/parent-assessment/route.ts",
  "apps/web-v2/app/api/bff/learners/[learnerId]/parent-assessment/submit/route.ts",
  "apps/web-v2/app/api/bff/learners/[learnerId]/iep-upload/route.ts",
  "apps/web-v2/app/api/bff/learners/[learnerId]/iep-upload/extract/route.ts",
  "apps/web-v2/app/api/bff/learners/[learnerId]/iep-upload/skip/route.ts",
  "apps/web-v2/app/api/bff/learners/[learnerId]/brain-profile/route.ts",
  "apps/web-v2/app/api/bff/learners/[learnerId]/brain-profile/regenerate/route.ts",
  "apps/web-v2/app/api/bff/learners/[learnerId]/baseline/route.ts",
];

for (const rel of REQUIRED_BFF) {
  if (!existsSync(join(repoRoot, rel))) {
    errors.push(`missing onboarding BFF: ${rel}`);
  }
}

if (errors.length) {
  for (const e of errors) console.error(`error: ${e}`);
  console.error(`\nonboarding:audit FAILED with ${errors.length} error(s).`);
  process.exit(1);
}

console.log(
  `onboarding:audit OK — readiness state machine, ${REQUIRED_PAGES.length} required page(s), ${REQUIRED_BFF.length} required BFF endpoint(s) verified.`,
);
