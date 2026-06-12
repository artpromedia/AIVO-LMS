#!/usr/bin/env node
/**
 * feature-flag:audit — Sprint B2 regression guard.
 *
 *  1. Tenant resolution exists and keeps its precedence contract
 *     (kill > tenant override > env default) with tests.
 *  2. identity-svc serves /api/users/me/flags and the platform-admin
 *     override PATCH, audited through the hash-chained activity log.
 *  3. Request-time surfaces resolve flags PER TENANT — no raw
 *     `resolveEnterpriseFlags(process.env)` / `AIVO_FEATURE_*` reads in
 *     web-v2 app code outside the sanctioned tenant-flags helper and the
 *     read-only platform inventory route.
 *  4. Mobile gates the selfRegulationHub surface through useFlags().
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];

function read(rel) {
  const abs = join(repoRoot, rel);
  if (!existsSync(abs)) {
    errors.push(`${rel}: required file missing`);
    return "";
  }
  return readFileSync(abs, "utf8");
}

function requireAll(rel, patterns) {
  const src = read(rel);
  if (!src) return;
  for (const [label, pattern] of patterns) {
    if (!pattern.test(src)) errors.push(`${rel}: missing ${label}`);
  }
}

// 1 — resolver + tests
requireAll("packages/feature-flags/src/tenant-flags.ts", [
  ["kill-switch layer", /killSwitchEnvVar/],
  ["tenant override layer", /loadOverrides/],
  ["cache + invalidate", /invalidate\(/],
]);
requireAll("packages/feature-flags/src/__tests__/tenant-flags.test.ts", [
  ["precedence test", /kill > tenant override > env default/],
  ["kill-beats-override test", /defeats an ON tenant override/],
  ["cache/invalidate test", /re-loads after invalidate/],
]);

// 2 — identity endpoints + audit
requireAll("services/identity-svc/src/routes/feature-flags.ts", [
  ["me/flags endpoint", /\/api\/users\/me\/flags/],
  ["platform override PATCH", /\/api\/admin\/tenants\/:tenantId\/flags\/:flagKey/],
  ["hash-chained audit", /appendAudit\(/],
  ["unknown-flag rejection", /isValidFlagKey/],
  ["cache invalidation on write", /resolver\.invalidate\(tenantId\)/],
]);

// 3 — no raw env flag reads in web-v2 request code
const registrySource = read("packages/feature-flags/src/enterprise-flags.ts");
const enterpriseEnvVars = [
  ...registrySource.matchAll(/:\s*"((?:AIVO_FEATURE|ADMIN_ENTERPRISE)_[A-Z0-9_]+)"/g),
].map((m) => m[1]);
if (enterpriseEnvVars.length === 0) {
  errors.push("packages/feature-flags: could not parse the enterprise flag registry");
}

const SANCTIONED = new Set([
  "apps/web-v2/lib/bff/tenant-flags.ts",
  // Read-only platform-wide ENV inventory (defaults layer), not a gate:
  "apps/web-v2/app/api/bff/admin/feature-flags/route.ts",
]);
function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (["node_modules", ".next", "dist"].includes(name) || name.startsWith(".")) continue;
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) yield* walk(abs);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) yield abs;
  }
}
for (const dir of ["apps/web-v2/app", "apps/web-v2/lib", "apps/web-v2/components"]) {
  for (const file of walk(join(repoRoot, dir))) {
    const rel = file.slice(repoRoot.length + 1).replaceAll("\\", "/");
    if (SANCTIONED.has(rel)) continue;
    const src = readFileSync(file, "utf8");
    if (/resolveEnterpriseFlags\(/.test(src)) {
      errors.push(`${rel}: resolveEnterpriseFlags() at request time — use getTenantFlags()`);
    }
    // Only ENTERPRISE flags are tenant-scoped; ops pipeline selectors
    // (e.g. AIVO_FEATURE_BASELINE_*) remain env-level by design. The
    // enterprise list is parsed from the registry so it can't drift.
    for (const envVar of enterpriseEnvVars) {
      if (src.includes(`process.env.${envVar}`)) {
        errors.push(`${rel}: raw ${envVar} env read — use getTenantFlags()`);
      }
    }
  }
}

// 4 — mobile gating
requireAll("apps/mobile/hooks/useFlags.ts", [
  ["identity flags fetch", /\/api\/users\/me\/flags/],
  ["fail-closed defaults", /NO_FLAGS/],
]);
requireAll("apps/mobile/app/(learner)/calm.tsx", [
  ["calm gated by tenant flag", /flags\.selfRegulationHub/],
]);

if (errors.length > 0) {
  console.error(`feature-flag:audit FAILED with ${errors.length} finding(s).`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(
  "feature-flag:audit OK — tenant resolver (kill>override>default) wired through identity, web-v2, mobile; overrides audited on the hash chain.",
);
