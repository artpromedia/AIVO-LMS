#!/usr/bin/env node
// shell:audit — Phase 0 gate for ADR 0020 (single shell, multi-role).
//
// Enforces the "one app per platform, many roles" contract:
//
// 1. /apps contains only the allowed top-level shells. Adding a new
//    role-specific app (e.g. apps/parent, apps/teacher-mobile,
//    apps/therapist-web, apps/learner-portal) is rejected.
// 2. Any newly-introduced /apps/<dir> must be added to ALLOWED_APPS
//    in this file in the same PR — a forcing function that requires a
//    deliberate decision (and an ADR amendment if it is a role
//    surface).
//
// See docs/adr/0020-single-shell-multi-role.md.

import { readdirSync, statSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const appsDir = join(repoRoot, "apps");

/**
 * Top-level applications that are explicitly allowed under /apps.
 *
 * - `web-v2`   — the authenticated learner/parent/teacher Next.js shell.
 * - `web-admin` — the isolated administrator Next.js shell.
 * - `mobile`   — the only Expo app (all role surfaces live here).
 * - `marketing`— the unauthenticated marketing site; not a role
 *                surface, only drives sign-up into web-v2.
 *
 * Anything else under /apps is a contract violation per ADR 0020
 * unless a successor ADR explicitly approves it.
 */
const ALLOWED_APPS = new Set(["web-v2", "web-admin", "mobile", "marketing"]);

/**
 * Patterns that strongly suggest someone tried to split a role into
 * its own app. We surface these in the failure message so the offender
 * gets a pointed nudge toward route segments instead.
 */
const ROLE_TOKENS = [
  "learner",
  "parent",
  "teacher",
  "therapist",
  "caregiver",
  "school-admin",
  "schooladmin",
  "district",
  "district-admin",
  "districtadmin",
  "admin",
  "internal",
  "staff",
  "tutor",
];

const errors = [];

if (!existsSync(appsDir)) {
  console.error(`[shell:audit] expected ${appsDir} to exist`);
  process.exit(1);
}

const entries = readdirSync(appsDir).filter((name) => {
  if (name.startsWith(".")) return false;
  try {
    return statSync(join(appsDir, name)).isDirectory();
  } catch {
    return false;
  }
});

for (const name of entries) {
  if (ALLOWED_APPS.has(name)) continue;

  const lower = name.toLowerCase();
  const looksLikeRoleApp = ROLE_TOKENS.some(
    (tok) => lower === tok || lower.startsWith(`${tok}-`) || lower.endsWith(`-${tok}`),
  );

  if (looksLikeRoleApp) {
    errors.push(
      `apps/${name} appears to be a role-specific application. ADR 0020 ` +
        `forbids splitting roles into their own apps. Add the surface as a ` +
        `route segment under apps/web-v2/app/<role>/* (web) or ` +
        `apps/mobile/app/(<role>)/* (mobile), and extend ` +
        `packages/nav/src/roles.ts + permissions.ts if a new role is needed.`,
    );
  } else {
    errors.push(
      `apps/${name} is not in the ALLOWED_APPS list. If this is a ` +
        `legitimate new top-level app (not a role surface), add it to ` +
        `ALLOWED_APPS in scripts/single-shell-audit.mjs and amend ` +
        `docs/adr/0020-single-shell-multi-role.md in the same PR.`,
    );
  }
}

if (errors.length > 0) {
  console.error("✖ shell:audit failed:\n");
  for (const e of errors) console.error(`  - ${e}\n`);
  console.error(
    "See docs/adr/0020-single-shell-multi-role.md for the single-shell, multi-role contract.",
  );
  process.exit(1);
}

console.log(
  `✓ shell:audit passed — /apps contains only allowed shells (${[...ALLOWED_APPS].sort().join(", ")}).`,
);
