#!/usr/bin/env node
/**
 * Single-listing audit — ADR 0020 Phase 4, slice 4.2.
 *
 * Mirrors `scripts/single-shell-audit.mjs` for mobile. Fails CI if
 * `apps/mobile/app.json` ever grows a sibling app config or a
 * per-role bundle id, or if `eas.json` adds a per-role build profile.
 *
 * Run from the repo root:
 *
 *   node apps/mobile/scripts/check-single-listing.mjs
 *
 * The script intentionally has no dependencies so it can run in
 * setup-steps before `pnpm install`.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const mobileDir = join(here, "..");

const ALLOWED_PROFILES = new Set(["development", "staging", "production"]);

// Bundle id / package id pinned by ADR 0020 §5. Changing either of
// these is a release-management decision, not a code-style decision —
// it warrants its own ADR.
const REQUIRED_IOS_BUNDLE = "com.artpromedia.aivo";
const REQUIRED_ANDROID_PACKAGE = "com.artpromedia.aivo";

// Per-role bundle/package suffixes that must never appear.
const PROHIBITED_ID_SUFFIXES = [".parent", ".teacher", ".learner", ".therapist", ".caregiver"];

const failures = [];

function fail(msg) {
  failures.push(msg);
}

/* ────────────────────── 1. app.json must be single ────────────────────── */

const appJsonPath = join(mobileDir, "app.json");
const appJson = JSON.parse(readFileSync(appJsonPath, "utf8"));
const expo = appJson.expo ?? {};
if (expo.ios?.bundleIdentifier !== REQUIRED_IOS_BUNDLE) {
  fail(
    `app.json expo.ios.bundleIdentifier is "${expo.ios?.bundleIdentifier}"; ` +
      `ADR 0020 §5 pins it to "${REQUIRED_IOS_BUNDLE}".`,
  );
}
if (expo.android?.package !== REQUIRED_ANDROID_PACKAGE) {
  fail(
    `app.json expo.android.package is "${expo.android?.package}"; ` +
      `ADR 0020 §5 pins it to "${REQUIRED_ANDROID_PACKAGE}".`,
  );
}

for (const suffix of PROHIBITED_ID_SUFFIXES) {
  if (expo.ios?.bundleIdentifier?.endsWith(suffix)) {
    fail(
      `app.json iOS bundle id "${expo.ios.bundleIdentifier}" carries the prohibited per-role suffix "${suffix}".`,
    );
  }
  if (expo.android?.package?.endsWith(suffix)) {
    fail(
      `app.json Android package "${expo.android.package}" carries the prohibited per-role suffix "${suffix}".`,
    );
  }
}

/* ───────────────────── 2. No sibling app.* configs ─────────────────────── */

for (const entry of readdirSync(mobileDir)) {
  if (entry === "app.json") continue;
  if (!entry.startsWith("app.")) continue;
  // Permitted: app.config.{js,ts,cjs,mjs} (Expo allows one of these);
  // forbidden: app.parent.json, app.teacher.json, etc.
  if (/^app\.config\.(c|m)?(js|ts)$/.test(entry)) continue;
  const path = join(mobileDir, entry);
  if (statSync(path).isFile()) {
    fail(
      `Found sibling Expo config "${entry}" in apps/mobile; ADR 0020 §1 ` +
        `requires exactly one mobile app config (app.json or app.config.*).`,
    );
  }
}

/* ───────────────────── 3. EAS profiles: dev / staging / prod ──────────── */

const easJsonPath = join(mobileDir, "eas.json");
const easJson = JSON.parse(readFileSync(easJsonPath, "utf8"));
const buildProfiles = Object.keys(easJson.build ?? {});
for (const profile of buildProfiles) {
  if (!ALLOWED_PROFILES.has(profile)) {
    fail(
      `eas.json declares build profile "${profile}"; ADR 0020 §5 only ` +
        `permits ${[...ALLOWED_PROFILES].join(", ")}.`,
    );
  }
}
for (const required of ALLOWED_PROFILES) {
  if (!buildProfiles.includes(required)) {
    fail(
      `eas.json is missing required build profile "${required}". ` +
        `ADR 0020 §5 requires exactly development, staging, and production.`,
    );
  }
}

/* ────────────────────────────── Report ────────────────────────────────── */

if (failures.length > 0) {
  console.error("\n❌ Mobile single-listing audit failed:\n");
  for (const f of failures) console.error("  • " + f);
  console.error("\nSee docs/adr/0020-single-shell-multi-role.md §Phase 4 for the rationale.\n");
  process.exit(1);
}

console.log("✅ Mobile single-listing audit passed");
console.log(`   iOS bundle id: ${expo.ios?.bundleIdentifier}`);
console.log(`   Android package: ${expo.android?.package}`);
console.log(`   EAS profiles: ${buildProfiles.join(", ")}`);
