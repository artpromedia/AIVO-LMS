#!/usr/bin/env node
// brand:check — verifies that every public-facing app ships the brand
// assets the brand package declares as required.
//
// Sprint 01 ownership. The list of required and canonical assets lives in
// `packages/brand/src/assets.ts`; this script reads that file at runtime
// so the two cannot drift.
//
// Behavior:
//   - Critical assets missing in any app  → exit 1
//   - Canonical assets missing            → warn, exit 0
//   - All present                         → exit 0
//
// Apps audited:
//   - apps/web/public
//   - apps/web-v2/public        (created if not present is acceptable)
//   - apps/marketing/public
//   - apps/mobile/assets
//
// Mobile uses a different layout (assets/images/{icon,splash-icon}.png)
// and is checked separately using its app.json declarations.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

// Parse REQUIRED_BRAND_ASSETS from the brand package source so the script
// stays in lock-step with the package's declared contract. The source uses
// identifier references like `LEGACY_LOGOS.purple` and spreads like
// `...Object.values(CANONICAL_LOGOS).filter(...)`. We resolve both.
const assetsSource = readFileSync(join(repoRoot, "packages/brand/src/assets.ts"), "utf8");

function parseExportedObjects(src) {
  const objects = {};
  const re = /export const (\w+) = \{([\s\S]*?)\} as const;/g;
  for (const m of src.matchAll(re)) {
    const name = m[1];
    const body = m[2];
    const entries = {};
    for (const pairMatch of body.matchAll(/(\w+):\s*"([^"]+)"/g)) {
      entries[pairMatch[1]] = pairMatch[2];
    }
    objects[name] = entries;
  }
  return objects;
}

const exportedObjects = parseExportedObjects(assetsSource);

function extractAssetList(label) {
  const blockMatch = assetsSource.match(new RegExp(`${label}:\\s*\\[([\\s\\S]*?)\\]`));
  if (!blockMatch) return [];
  // Strip filter() expressions so their literal arguments (".png", etc.)
  // are not mistaken for asset paths.
  const body = blockMatch[1].replace(/\.filter\([^)]*\)/g, "");
  const result = [];

  for (const lit of body.matchAll(/"([^"]+)"/g)) {
    if (lit[1].startsWith("/") || lit[1].startsWith("./")) {
      result.push(lit[1]);
    }
  }
  for (const idRef of body.matchAll(/([A-Z][A-Z0-9_]+)\.(\w+)/g)) {
    const [, obj, key] = idRef;
    const value = exportedObjects[obj]?.[key];
    if (value) result.push(value);
  }
  for (const spread of body.matchAll(
    /\.\.\.Object\.values\((\w+)\)(?:\.filter\([^)]*endsWith\("([^"]+)"\)\))?/g,
  )) {
    const [, obj, filterExt] = spread;
    const values = Object.values(exportedObjects[obj] ?? {});
    for (const v of values) {
      if (!filterExt || v.endsWith(filterExt)) result.push(v);
    }
  }
  return [...new Set(result)];
}

const criticalAssets = extractAssetList("critical");
const canonicalAssets = extractAssetList("canonical");

if (criticalAssets.length === 0) {
  console.error(
    "brand:check could not parse REQUIRED_BRAND_ASSETS.critical — assets.ts shape changed?",
  );
  process.exit(1);
}

const APPS = [
  { name: "web", publicDir: "apps/web/public" },
  { name: "web-v2", publicDir: "apps/web-v2/public" },
  { name: "marketing", publicDir: "apps/marketing/public" },
];

const errors = [];
const warnings = [];

for (const app of APPS) {
  const publicDir = join(repoRoot, app.publicDir);
  if (!existsSync(publicDir)) {
    warnings.push(`${app.name}: public dir does not exist (${app.publicDir}); skipping`);
    continue;
  }
  for (const rel of criticalAssets) {
    const full = join(publicDir, rel.replace(/^\//, ""));
    if (!existsSync(full)) {
      errors.push(`${app.name}: missing CRITICAL brand asset ${rel}`);
    }
  }
  for (const rel of canonicalAssets) {
    const full = join(publicDir, rel.replace(/^\//, ""));
    if (!existsSync(full)) {
      warnings.push(`${app.name}: missing canonical brand asset ${rel}`);
    }
  }
}

// Mobile uses different paths declared in app.json.
const mobileAppJsonPath = join(repoRoot, "apps/mobile/app.json");
if (existsSync(mobileAppJsonPath)) {
  const mobileConfig = JSON.parse(readFileSync(mobileAppJsonPath, "utf8"));
  const expo = mobileConfig.expo ?? {};
  const mobileRoot = join(repoRoot, "apps/mobile");
  const requiredMobileAssets = [
    expo.icon,
    expo.splash?.image,
    expo.ios?.splash?.image,
    expo.android?.splash?.image,
    expo.android?.adaptiveIcon?.foregroundImage,
  ].filter(Boolean);
  for (const rel of requiredMobileAssets) {
    const full = join(mobileRoot, rel.replace(/^\.\//, ""));
    if (!existsSync(full)) {
      errors.push(`mobile: missing CRITICAL asset declared in app.json: ${rel}`);
    }
  }
} else {
  warnings.push("mobile: apps/mobile/app.json not found");
}

if (warnings.length) {
  for (const w of warnings) console.warn(`warn: ${w}`);
}
if (errors.length) {
  for (const e of errors) console.error(`error: ${e}`);
  console.error(`\nbrand:check FAILED with ${errors.length} critical asset error(s).`);
  process.exit(1);
}

console.log(
  `brand:check OK — ${criticalAssets.length} critical assets present across ${APPS.length} app(s); ${warnings.length} canonical asset warning(s).`,
);
