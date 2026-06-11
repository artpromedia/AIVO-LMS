#!/usr/bin/env node
/**
 * observability:audit — Sprint A2 regression guard.
 *
 * Locks in the client-side observability floor:
 *   1. Every app surface (web-v2, web-admin, mobile) initializes Sentry.
 *   2. Every init routes events through the shared COPPA scrubber
 *      (packages/observability sentry-scrub) via beforeSend.
 *   3. The mobile root navigator is wrapped in the ErrorBoundary, and the
 *      stage player keeps its crash-snapshot path.
 *   4. No DSN is hardcoded anywhere — DSNs come from env only.
 *   5. Error boundaries report (captureException) before recovering.
 *
 * Mirrors the structure of the other static gates: pure file checks,
 * fail-fast, registered in scripts/release-gate.mjs AND
 * .github/workflows/production-gates.yml.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];

function read(rel) {
  const abs = resolve(repoRoot, rel);
  if (!existsSync(abs)) {
    errors.push(`${rel}: required observability file is missing`);
    return "";
  }
  return readFileSync(abs, "utf8");
}

function requirePatterns(rel, patterns) {
  const source = read(rel);
  if (!source) return;
  for (const [label, pattern] of patterns) {
    if (!pattern.test(source)) errors.push(`${rel}: missing ${label}`);
  }
}

// ── 1+2: Sentry init + scrubber on every surface ───────────────────────────
const SCRUB = /scrubSentryEvent/;
for (const app of ["web-v2", "web-admin"]) {
  requirePatterns(`apps/${app}/instrumentation.ts`, [
    ["runtime register()", /export async function register/],
    ["request error forwarding", /onRequestError/],
  ]);
  requirePatterns(`apps/${app}/instrumentation-client.ts`, [
    ["Sentry.init", /Sentry\.init\(/],
    ["COPPA scrubber in beforeSend", SCRUB],
    ["PII off", /sendDefaultPii:\s*false/],
  ]);
  requirePatterns(`apps/${app}/sentry.server.config.ts`, [
    ["Sentry.init", /Sentry\.init\(/],
    ["COPPA scrubber in beforeSend", SCRUB],
    ["PII off", /sendDefaultPii:\s*false/],
  ]);
  requirePatterns(`apps/${app}/next.config.ts`, [["withSentryConfig wrap", /withSentryConfig\(/]]);
}
requirePatterns("apps/mobile/lib/sentry.ts", [
  ["Sentry.init", /Sentry\.init\(/],
  ["COPPA scrubber in beforeSend", SCRUB],
  ["PII off", /sendDefaultPii:\s*false/],
]);

// ── 3: mobile error boundaries ──────────────────────────────────────────────
requirePatterns("apps/mobile/app/_layout.tsx", [
  ["initSentry before render", /initSentry\(\)/],
  ["root ErrorBoundary wrap", /<ErrorBoundary scope="root">/],
]);
requirePatterns("apps/mobile/components/ErrorBoundary.tsx", [
  ["componentDidCatch reports", /Sentry\.captureException\(/],
  ["recovery affordances", /errorBoundary\.tryAgain/],
]);
requirePatterns("apps/mobile/app/(learner)/stage/[sessionId].tsx", [
  ["stage boundary", /<ErrorBoundary[\s\S]*scope="stage"/],
  ["crash snapshot queued", /onBeforeRecover/],
]);

// ── web error boundaries report ─────────────────────────────────────────────
requirePatterns("apps/web-v2/app/error.tsx", [["captureException", /Sentry\.captureException\(/]]);
requirePatterns("apps/web-v2/app/global-error.tsx", [
  ["captureException", /Sentry\.captureException\(/],
]);
requirePatterns("apps/web-admin/app/error.tsx", [
  ["captureException", /Sentry\.captureException\(/],
]);

// ── web vitals reporting mounted ────────────────────────────────────────────
requirePatterns("apps/web-v2/app/layout.tsx", [["WebVitalsReporter mount", /<WebVitalsReporter \/>/]]);

// ── 4: no hardcoded DSNs anywhere in app code ──────────────────────────────
import { readdirSync, statSync } from "node:fs";
function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name.startsWith(".")) continue;
    const abs = resolve(dir, name);
    if (statSync(abs).isDirectory()) yield* walk(abs);
    else if (/\.(ts|tsx|js|mjs|json)$/.test(name) && !/\.test\.[tj]sx?$/.test(name)) yield abs;
  }
}
const DSN_LITERAL = /https:\/\/[0-9a-f]{16,}@[a-z0-9.-]*sentry\.io\//i;
for (const app of ["apps/web-v2", "apps/web-admin", "apps/mobile"]) {
  for (const file of walk(resolve(repoRoot, app))) {
    const source = readFileSync(file, "utf8");
    if (DSN_LITERAL.test(source)) {
      errors.push(`${file.slice(repoRoot.length + 1)}: hardcoded Sentry DSN — DSNs come from env only`);
    }
  }
}

if (errors.length > 0) {
  console.error(`observability:audit FAILED with ${errors.length} finding(s).`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}
console.log(
  "observability:audit OK — Sentry init + COPPA scrubber on all 3 surfaces, " +
    "mobile boundaries wired, no hardcoded DSNs.",
);
