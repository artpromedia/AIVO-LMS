#!/usr/bin/env node
// rbac:audit — Phase 5 starter for ADR 0020 (single shell, multi-role).
//
// Verifies the role × nav-area permission matrix in
// packages/nav/src/permissions.ts is internally consistent:
//
//   1. Every Role declared in roles.ts has a top-level entry in MATRIX.
//      (TypeScript already enforces this at compile time; we re-check
//      here so a hand-edited matrix is caught even before tsc runs.)
//   2. Every per-area entry uses one of the four access values
//      ("full" | "linked" | "locked" | "hidden").
//   3. "full" and "linked" entries declare at least one of webRoute /
//      mobileRoute, so the route resolver can produce a destination.
//   4. "locked" entries declare a lockReason so <LockedScreen> has
//      copy to render.
//   5. Every NavArea referenced inside MATRIX is one of the canonical
//      NAV_AREAS, so a typo cannot silently disable a nav row.
//
// This audit is intentionally a pure text scan: it has zero runtime
// dependencies on the compiled @aivo/nav package, so it can run
// before `pnpm -r build` in CI.
//
// Formatting contract: the MATRIX in permissions.ts is expected to use
// 2-space indentation for role blocks and 4-space indentation for area
// entries (the style produced by prettier in this repo). If that style
// ever changes, update the BLOCK_RE / AREA_RE patterns below.

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const navSrc = join(repoRoot, "packages", "nav", "src");

const ACCESS_VALUES = new Set(["full", "linked", "locked", "hidden"]);

function readFile(relative) {
  return readFileSync(join(navSrc, relative), "utf8");
}

function extractStringList(source, identifier) {
  // Matches: export const IDENT: readonly X[] = [ "a", "b", ... ] as const;
  const re = new RegExp(
    String.raw`export\s+const\s+${identifier}\b[^=]*=\s*\[([\s\S]*?)\]\s*as\s+const`,
    "m",
  );
  const m = source.match(re);
  if (!m) return null;
  return [...m[1].matchAll(/["']([^"']+)["']/g)].map((x) => x[1]);
}

const errors = [];
const warnings = [];

const rolesSrc = readFile("roles.ts");
const areasSrc = readFile("areas.ts");
const permsSrc = readFile("permissions.ts");

const roles = extractStringList(rolesSrc, "ROLES");
const areas = extractStringList(areasSrc, "NAV_AREAS");

if (!roles) errors.push("Could not parse ROLES from packages/nav/src/roles.ts.");
if (!areas) errors.push("Could not parse NAV_AREAS from packages/nav/src/areas.ts.");

if (roles && areas) {
  const areaSet = new Set(areas);

  // Slice each role block out of the MATRIX object literal. We anchor
  // on lines like "  learner: {" and read until the matching "  },".
  for (const role of roles) {
    const blockRe = new RegExp(
      String.raw`^\s{2}${role}:\s*\{([\s\S]*?)^\s{2}\},`,
      "m",
    );
    const m = permsSrc.match(blockRe);
    if (!m) {
      errors.push(
        `Role "${role}" has no entry in MATRIX (packages/nav/src/permissions.ts). ` +
          `Every role in ROLES must appear in MATRIX, even if every area is hidden.`,
      );
      continue;
    }
    const block = m[1];

    // Pull out each "areaKey: { access: "...", webRoute: "...", ... }".
    const areaRe = /^\s{4}([A-Za-z][A-Za-z0-9]*):\s*\{([\s\S]*?)\},?$/gm;
    let entryCount = 0;
    let am;
    while ((am = areaRe.exec(block)) !== null) {
      entryCount++;
      const areaKey = am[1];
      const body = am[2];

      if (!areaSet.has(areaKey)) {
        errors.push(
          `Role "${role}" references unknown NavArea "${areaKey}" in MATRIX. ` +
            `Add it to NAV_AREAS in areas.ts first, or remove the typo.`,
        );
        continue;
      }

      const accessMatch = body.match(/access:\s*["']([^"']+)["']/);
      if (!accessMatch) {
        errors.push(
          `Role "${role}" area "${areaKey}" is missing an "access" value.`,
        );
        continue;
      }
      const access = accessMatch[1];
      if (!ACCESS_VALUES.has(access)) {
        errors.push(
          `Role "${role}" area "${areaKey}" has invalid access "${access}". ` +
            `Allowed: ${[...ACCESS_VALUES].join(", ")}.`,
        );
        continue;
      }

      const hasWebRoute = /webRoute:\s*["']/.test(body);
      const hasMobileRoute = /mobileRoute:\s*["']/.test(body);
      const hasLockReason = /lockReason:\s*["']/.test(body);

      if ((access === "full" || access === "linked") && !hasWebRoute && !hasMobileRoute) {
        errors.push(
          `Role "${role}" area "${areaKey}" is access="${access}" but declares ` +
            `neither webRoute nor mobileRoute. resolveRoute() would return null.`,
        );
      }
      if (access === "locked" && !hasLockReason) {
        warnings.push(
          `Role "${role}" area "${areaKey}" is locked but has no lockReason; ` +
            `<LockedScreen> will render an empty explanation.`,
        );
      }
    }

    if (entryCount === 0) {
      warnings.push(
        `Role "${role}" has zero areas declared in MATRIX. The role can sign ` +
          `in but has nowhere to navigate.`,
      );
    }
  }
}

if (warnings.length > 0) {
  console.warn("⚠ rbac:audit warnings:");
  for (const w of warnings) console.warn(`  - ${w}`);
  console.warn("");
}

if (errors.length > 0) {
  console.error("✖ rbac:audit failed:");
  for (const e of errors) console.error(`  - ${e}`);
  console.error(
    "\nSee packages/nav/src/permissions.ts and docs/adr/0020-single-shell-multi-role.md.",
  );
  process.exit(1);
}

const roleCount = roles ? roles.length : 0;
const areaCount = areas ? areas.length : 0;
console.log(
  `✓ rbac:audit passed — MATRIX classified for ${roleCount} roles × ${areaCount} areas.`,
);
