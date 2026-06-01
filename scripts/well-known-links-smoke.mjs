#!/usr/bin/env node
/**
 * Universal-link smoke test — ADR 0020 Phase 4, slice 4.3.
 *
 * Validates that the deployed origin serves the AASA and
 * assetlinks.json manifests with:
 *   - the right content-type
 *   - parseable JSON
 *   - the production bundle id / package id
 *   - path coverage for every role-segmented and cross-cutting route
 *
 * Usage:
 *
 *   node scripts/well-known-links-smoke.mjs https://aivo.app
 *
 * Exits non-zero on any failure so it can gate a release workflow.
 * Has zero dependencies so it runs before `pnpm install`.
 */

const origin = process.argv[2];
if (!origin) {
  console.error("usage: well-known-links-smoke.mjs <origin>");
  process.exit(2);
}

const REQUIRED_AASA_PATHS = [
  "/learner/*",
  "/parent/*",
  "/teacher/*",
  "/therapist/*",
  "/caregiver/*",
  "/notifications",
  "/messages",
  "/settings",
  "/billing",
  "/role-switch",
];

const REQUIRED_BUNDLE_FRAGMENT = ".com.artpromedia.aivo";
const REQUIRED_ANDROID_PACKAGE = "com.artpromedia.aivo";

let failed = 0;
function fail(msg) {
  console.error("  ❌ " + msg);
  failed++;
}
function ok(msg) {
  console.log("  ✅ " + msg);
}

async function fetchJson(path) {
  const url = `${origin}${path}`;
  const res = await fetch(url);
  if (!res.ok) {
    fail(`${path} returned HTTP ${res.status}`);
    return null;
  }
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    fail(`${path} has content-type "${ct}"; expected application/json`);
  } else {
    ok(`${path} content-type is application/json`);
  }
  try {
    return JSON.parse(await res.text());
  } catch (err) {
    fail(`${path} is not valid JSON: ${err.message}`);
    return null;
  }
}

console.log(`Smoke-testing universal/app links against ${origin}\n`);

const aasa = await fetchJson("/.well-known/apple-app-site-association");
if (aasa) {
  const details = aasa.applinks?.details ?? [];
  const appIds = details.flatMap((d) => d.appIDs ?? []);
  if (!appIds.some((id) => id.endsWith(REQUIRED_BUNDLE_FRAGMENT))) {
    fail(
      `AASA appIDs ${JSON.stringify(appIds)} do not include the required ` +
        `production bundle id "${REQUIRED_BUNDLE_FRAGMENT}"`,
    );
  } else {
    ok(`AASA carries the production bundle id`);
  }
  const allComponents = details.flatMap((d) =>
    (d.components ?? []).map((c) => c["/"]),
  );
  for (const required of REQUIRED_AASA_PATHS) {
    if (!allComponents.includes(required)) {
      fail(`AASA missing required path "${required}"`);
    }
  }
  if (failed === 0) ok(`AASA covers all required role paths`);
}

const assetlinks = await fetchJson("/.well-known/assetlinks.json");
if (assetlinks) {
  if (!Array.isArray(assetlinks)) {
    fail(`assetlinks.json must be a JSON array`);
  } else {
    const found = assetlinks.find(
      (entry) => entry?.target?.package_name === REQUIRED_ANDROID_PACKAGE,
    );
    if (!found) {
      fail(
        `assetlinks.json missing package_name "${REQUIRED_ANDROID_PACKAGE}"`,
      );
    } else {
      ok(`assetlinks.json carries the production package name`);
      const fps = found.target?.sha256_cert_fingerprints ?? [];
      if (fps.length === 0) {
        fail(`assetlinks.json has no sha256 fingerprints`);
      } else {
        ok(`assetlinks.json declares ${fps.length} signing fingerprint(s)`);
      }
    }
  }
}

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log(`\nAll universal/app-link smoke checks passed`);
