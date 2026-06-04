#!/usr/bin/env node
// a11y:audit — Sprint GREEN-09 gate.
//
// Distinct lens from `accessibility:audit` (which verifies the
// AccessibilityPreferences contract — fields, defaults, BFFs, TTS,
// AAC). This gate verifies the **runtime a11y contract** described
// in docs/accessibility/vpat-readiness.md:
//
//   1. Reduced-motion contract is wired end-to-end:
//        - apps/web-v2/lib/a11y/typeface.ts exports
//          REDUCED_MOTION_COOKIE, ReducedMotion type,
//          REDUCED_MOTION_DEFAULT, resolveReducedMotion.
//        - apps/web-v2/lib/a11y/server.ts exports
//          readReducedMotionFromCookies.
//        - apps/web-v2/lib/a11y/actions.ts exports
//          setReducedMotionCookie.
//        - apps/web-v2/app/layout.tsx calls
//          readReducedMotionFromCookies AND renders
//          data-reduced-motion on <html>.
//        - apps/web-v2/app/globals.css contains the
//          [data-reduced-motion="reduce"] motion-suppression rule.
//
//   2. Global focus + skip-link styling exists:
//        - apps/web-v2/app/globals.css defines *:focus-visible and
//          .skip-link styles. Keyboard-only users land here on every
//          first tab — no exceptions.
//
//   3. Axe-tagged Playwright coverage is wide enough to matter:
//        - apps/web-v2/e2e/ contains at least 4 *-a11y.playwright.ts
//          specs and each tags ≥1 test with `@a11y`.
//        - apps/web-v2/package.json wires `test:a11y` to
//          `playwright test --grep @a11y`.
//
//   4. VPAT readiness doc exists at
//      docs/accessibility/vpat-readiness.md.
//
//   5. Existing static accessibility:audit contract still passes —
//      spawned as a subprocess. If the AccessibilityPreferences shape,
//      defaults, or BFF surfaces drift, this gate fails too.
//
// This script does NOT spin up Playwright or a browser. Running the
// axe-tagged specs is a separate CI job (`pnpm --filter web-v2
// test:a11y`) that requires a live dev server + Playwright browsers.
// What we enforce here is that the *contract* the specs depend on is
// intact and that the spec inventory itself has not been deleted.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const errors = [];

function rel(p) {
  return p
    .replace(repoRoot + "\\", "")
    .replace(repoRoot + "/", "")
    .replaceAll("\\", "/");
}

function readOrFail(absPath, label) {
  if (!existsSync(absPath)) {
    errors.push(`${label}: missing ${rel(absPath)}`);
    return null;
  }
  return readFileSync(absPath, "utf8");
}

function requireAll(label, src, needles) {
  if (src == null) return;
  for (const needle of needles) {
    const ok = needle instanceof RegExp ? needle.test(src) : src.includes(needle);
    if (!ok) {
      errors.push(`${label}: missing required token ${String(needle)}`);
    }
  }
}

// ----- 1. Reduced-motion contract -----------------------------------

const typefacePath = join(repoRoot, "apps/web-v2/lib/a11y/typeface.ts");
const typefaceSrc = readOrFail(typefacePath, "reduced-motion/typeface");
requireAll("reduced-motion/typeface", typefaceSrc, [
  /export\s+const\s+REDUCED_MOTION_COOKIE\s*=/,
  /export\s+type\s+ReducedMotion\b/,
  /export\s+const\s+REDUCED_MOTION_DEFAULT\b/,
  /export\s+function\s+resolveReducedMotion\b/,
]);

const a11yServerPath = join(repoRoot, "apps/web-v2/lib/a11y/server.ts");
const a11yServerSrc = readOrFail(a11yServerPath, "reduced-motion/server");
requireAll("reduced-motion/server", a11yServerSrc, [
  /export\s+async\s+function\s+readReducedMotionFromCookies\b/,
]);

const a11yActionsPath = join(repoRoot, "apps/web-v2/lib/a11y/actions.ts");
const a11yActionsSrc = readOrFail(a11yActionsPath, "reduced-motion/actions");
requireAll("reduced-motion/actions", a11yActionsSrc, [
  /export\s+async\s+function\s+setReducedMotionCookie\b/,
]);

const layoutPath = join(repoRoot, "apps/web-v2/app/layout.tsx");
const layoutSrc = readOrFail(layoutPath, "reduced-motion/layout");
requireAll("reduced-motion/layout", layoutSrc, [
  /readReducedMotionFromCookies\s*\(/,
  /data-reduced-motion=\{?reducedMotion\}?/,
]);

const globalsPath = join(repoRoot, "apps/web-v2/app/globals.css");
const globalsSrc = readOrFail(globalsPath, "reduced-motion/globals");
requireAll("reduced-motion/globals", globalsSrc, [/\[data-reduced-motion="reduce"\]/]);

// ----- 2. Focus-visible + skip-link --------------------------------

requireAll("focus/globals", globalsSrc, [/\*:focus-visible\s*\{/, /\.skip-link\s*\{/]);

// ----- 3. Axe-tagged Playwright coverage ----------------------------

const e2eDir = join(repoRoot, "apps/web-v2/e2e");
if (!existsSync(e2eDir)) {
  errors.push("axe-coverage: apps/web-v2/e2e directory missing.");
} else {
  const specs = readdirSync(e2eDir).filter(
    (f) => f.endsWith("-a11y.playwright.ts") || f.endsWith("-a11y.playwright.tsx"),
  );
  if (specs.length < 4) {
    errors.push(
      `axe-coverage: expected ≥4 *-a11y.playwright.ts specs, found ${specs.length} (${specs.join(", ") || "none"}).`,
    );
  }
  const taggedSpecs = [];
  for (const spec of specs) {
    const src = readFileSync(join(e2eDir, spec), "utf8");
    if (/@a11y\b/.test(src)) taggedSpecs.push(spec);
    if (!/axe|injectAxe|checkA11y/.test(src)) {
      errors.push(`axe-coverage: ${spec} does not reference axe-playwright helpers.`);
    }
  }
  if (taggedSpecs.length < 4) {
    errors.push(
      `axe-coverage: expected ≥4 specs with @a11y-tagged tests, found ${taggedSpecs.length} (${taggedSpecs.join(", ") || "none"}).`,
    );
  }
}

const webPkgPath = join(repoRoot, "apps/web-v2/package.json");
const webPkgSrc = readOrFail(webPkgPath, "axe-coverage/web-v2 package.json");
if (webPkgSrc) {
  let parsed;
  try {
    parsed = JSON.parse(webPkgSrc);
  } catch (err) {
    errors.push(`axe-coverage: apps/web-v2/package.json is not valid JSON (${err.message}).`);
  }
  if (parsed) {
    const script = parsed.scripts?.["test:a11y"];
    if (!script || !/playwright test.*@a11y/.test(script)) {
      errors.push(
        `axe-coverage: apps/web-v2 package.json must define test:a11y as 'playwright test --grep @a11y' (got: ${script ?? "missing"}).`,
      );
    }
  }
}

// ----- 4. VPAT doc --------------------------------------------------

const vpatPath = join(repoRoot, "docs/accessibility/vpat-readiness.md");
if (!existsSync(vpatPath)) {
  errors.push("vpat: docs/accessibility/vpat-readiness.md missing.");
}

// ----- 5. Existing static accessibility:audit must still pass ------

const child = spawnSync(process.execPath, [join(repoRoot, "scripts/accessibility-audit.mjs")], {
  cwd: repoRoot,
  encoding: "utf8",
});
if (child.status !== 0) {
  errors.push(
    `accessibility:audit subprocess exited ${child.status}. Last stderr lines:\n${(child.stderr || child.stdout || "").split(/\r?\n/).slice(-12).join("\n")}`,
  );
}

// ----- Report -------------------------------------------------------

if (errors.length > 0) {
  console.error("a11y:audit FAILED");
  for (const err of errors) console.error(" - " + err);
  process.exit(1);
}

console.log(
  "a11y:audit OK — reduced-motion contract wired end-to-end, focus-visible + skip-link styled, ≥4 axe-tagged Playwright specs present, VPAT doc shipped, and accessibility:audit contract holds.",
);
