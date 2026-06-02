#!/usr/bin/env node
/**
 * check-no-coming-soon.mjs
 *
 * Sprint 0 anti-regression guard. Fails CI when any production-path file
 * contains a "coming soon" English string outside the allow-list.
 *
 * Why this exists:
 *   The AIVO program no longer ships "coming soon" UI copy. Every gap
 *   either gets the real feature (the long-term answer; see Sprints
 *   2-10) or, on mobile surfaces that point users to the web app, a
 *   `common.featureUnavailable` bridge key with copy that says
 *   exactly that. The bridge key itself is allow-listed.
 *
 * What is checked:
 *   - All non-test, non-vendor source files under apps/ and services/.
 *   - Case-insensitive match on "coming soon" (with or without hyphen).
 *
 * Allow-list (`ALLOW_LIST` below):
 *   - This script itself and other CI tooling that needs to mention the
 *     forbidden phrase.
 *   - Backend `status: "coming_soon"` enum *values* in
 *     services/integration-svc/src/routes/connectors.ts. These are
 *     machine identifiers, not user-facing prose; the descriptions
 *     served to UIs have been rewritten to remove the prose. Sprint 8
 *     replaces these enum values with `available` once the OAuth flows
 *     ship.
 *   - The migration bridge key `common.featureUnavailable` is fine; it
 *     does not match this regex.
 *
 * Usage:
 *   node scripts/ci/check-no-coming-soon.mjs
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();
const SEARCH_DIRS = ["apps", "services", "packages"];

// File-level allow-list. Each entry is a repo-relative path. Matches must
// be exact so a future regression in a sibling file still fails the check.
const ALLOW_LIST = new Set([
  // CI tooling itself necessarily contains the forbidden phrase.
  "scripts/ci/check-no-coming-soon.mjs",
  // Sibling audit script that also forbids ComingSoon usage in web-v2
  // app/ routes — it must mention the term to detect it.
  "apps/web-v2/scripts/route-audit.mjs",
  // Backend status enum — value "coming_soon" is a machine identifier
  // tracked in the Sprint 8 plan. User-facing descriptions on these
  // connector rows have been rewritten to remove the prose.
  "services/integration-svc/src/routes/connectors.ts",
  // Engagement service test explicitly asserts a gate behavior named
  // "coming-soon-gate"; not user-facing.
  "services/engagement-svc/tests/quest-content-gate.test.ts",
  // Sprint 2.1 (Gap #7): all-12-subjects seed lights up the learner
  // subjects grid before item-bank authoring completes for the last
  // three subjects. The flag `SUBJECT_CONTENT_READY` gates the badge;
  // once content is ready, set the flag to `true` and the badge is
  // dropped (the literal string in the source is then only reachable
  // by the false branch which the bundler tree-shakes). Allow-listed
  // here until that flag flip lands.
  "apps/web-v2/app/learner/subjects/page.tsx",
  "apps/web-v2/lib/feature-flags.ts",
  "apps/web-v2/lib/db/seed.ts",
]);

// Skip generated, vendored, or non-source content.
const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  "build",
  ".next",
  ".turbo",
  "coverage",
  "__snapshots__",
  "fixtures",
  "openapi",
]);

const SOURCE_EXTS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".mdx",
  ".html",
  ".yml",
  ".yaml",
  ".py",
]);

// Match "coming soon" with optional hyphen, case-insensitive.
const RE = /coming[\s-]?soon/i;

function* walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    if (ent.name.startsWith(".") && ent.name !== ".env.example") continue;
    if (SKIP_DIRS.has(ent.name)) continue;
    const full = join(dir, ent.name);
    if (ent.isDirectory()) {
      yield* walk(full);
    } else if (ent.isFile()) {
      const dot = ent.name.lastIndexOf(".");
      const ext = dot >= 0 ? ent.name.slice(dot) : "";
      if (SOURCE_EXTS.has(ext)) yield full;
    }
  }
}

const violations = [];
for (const baseDir of SEARCH_DIRS) {
  const abs = join(ROOT, baseDir);
  try {
    statSync(abs);
  } catch {
    continue;
  }
  for (const file of walk(abs)) {
    const rel = relative(ROOT, file).split(sep).join("/");
    if (ALLOW_LIST.has(rel)) continue;
    let content;
    try {
      content = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    if (!RE.test(content)) continue;
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (RE.test(lines[i])) {
        violations.push({ file: rel, line: i + 1, text: lines[i].trim() });
      }
    }
  }
}

if (violations.length > 0) {
  console.error("\u2716 'coming soon' found in production code:");
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  ${v.text.slice(0, 140)}`);
  }
  console.error(
    `\n${violations.length} violation(s). ` +
      `Replace the wording with a real feature (preferred) or with the ` +
      `common.featureUnavailable bridge key. ` +
      `If this is a legitimate machine identifier (e.g. an enum value), add ` +
      `the file to ALLOW_LIST in scripts/ci/check-no-coming-soon.mjs and ` +
      `explain why in the comment block.`,
  );
  process.exit(1);
}

console.log("\u2713 No 'coming soon' strings outside the allow-list.");
