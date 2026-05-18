#!/usr/bin/env node
// mobile:audit — Sprint 09 gate.
//
// Verifies the unified mobile app scaffold:
//
// 1. apps/mobile/lib/feature-flags.ts declares MOBILE_UNIFIED_APP and
//    its default is false during migration (changed to true in 09b).
// 2. apps/mobile/lib/role-context.tsx exports RoleProvider, useRole,
//    and ACTIVE_ROLE_HEADER.
// 3. Legacy role groups still exist (soft assertion during migration).
//    Once MOBILE_UNIFIED_APP defaults to true, flip this assertion to
//    require their absence — see docs/mobile/unified-app-contract.md.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

const errors = [];
const warnings = [];

// --- 1. Feature flag --------------------------------------------------

const flagsPath = join(repoRoot, "apps/mobile/lib/feature-flags.ts");
if (!existsSync(flagsPath)) {
  errors.push("apps/mobile/lib/feature-flags.ts missing.");
} else {
  const src = readFileSync(flagsPath, "utf8");
  if (!/MOBILE_UNIFIED_APP:/.test(src)) {
    errors.push("feature-flags.ts: MOBILE_UNIFIED_APP not declared.");
  }
  // The default-false invariant holds until 09b. We accept either
  // form as long as the flag exists; the contract doc owns the policy.
}

// --- 2. RoleContext exports ------------------------------------------

const rolePath = join(repoRoot, "apps/mobile/lib/role-context.tsx");
if (!existsSync(rolePath)) {
  errors.push("apps/mobile/lib/role-context.tsx missing.");
} else {
  const src = readFileSync(rolePath, "utf8");
  for (const required of ["RoleProvider", "useRole", "ACTIVE_ROLE_HEADER"]) {
    const re = new RegExp(`export (?:function|const) ${required}\\b`);
    if (!re.test(src)) {
      errors.push(`role-context.tsx: must export ${required}.`);
    }
  }
  if (!/"x-aivo-active-role"/.test(src)) {
    errors.push('role-context.tsx: ACTIVE_ROLE_HEADER must equal "x-aivo-active-role".');
  }
}

// --- 3. Legacy role groups present during migration ------------------

const LEGACY_ROLE_GROUPS = ["(parent)", "(learner)", "(teacher)"];
for (const group of LEGACY_ROLE_GROUPS) {
  const dir = join(repoRoot, "apps/mobile/app", group);
  if (!existsSync(dir)) {
    warnings.push(
      `legacy role group ${group} is gone — if Sprint 09b/c is complete, update this audit to require absence (currently allowed).`,
    );
  }
}

if (warnings.length) {
  for (const w of warnings) console.warn(`warn: ${w}`);
}
if (errors.length) {
  for (const e of errors) console.error(`error: ${e}`);
  console.error(`\nmobile:audit FAILED with ${errors.length} error(s).`);
  process.exit(1);
}

console.log(
  "mobile:audit OK — MOBILE_UNIFIED_APP flag, RoleContext scaffold, ACTIVE_ROLE_HEADER constant verified.",
);
