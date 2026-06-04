#!/usr/bin/env node
// mobile:role-audit — Sprint GREEN-07 gate.
//
// Distinct from `mobile:audit` (which checks the unified-app scaffold
// presence). This gate enforces the *runtime role* contract from
// docs/mobile/unified-app-contract.md and ADR 0020 (active-role hint):
//
//   1. apps/mobile/lib/active-role.ts exports the canonical helpers and
//      pins ACTIVE_ROLE_HEADER === "x-aivo-active-role".
//   2. apps/mobile/lib/role-context.tsx exports RoleProvider, useRole,
//      ACTIVE_ROLE_HEADER, the RoleContextValue shape, and the
//      ActiveLearnerContext type. Header constant matches active-role.ts.
//   3. RoleContextValue declares every required field (availableRoles,
//      activeRole, setActiveRole, lastPathByRole, rememberPath,
//      activeLearner, setActiveLearner) and setActiveRole rejects roles
//      that aren't in availableRoles.
//   4. apps/mobile/lib/api.ts imports applyActiveRoleHeader and invokes
//      it inside apiFetch so every authenticated request carries the
//      active-role hint.
//   5. apps/mobile/lib/feature-flags.ts declares MOBILE_UNIFIED_APP via
//      EXPO_PUBLIC_MOBILE_UNIFIED_APP.
//   6. Legacy/unified mutual exclusion: when MOBILE_UNIFIED_APP default
//      is false the five legacy role groups MUST all exist; when the
//      default flips to true the audit requires they are all gone and
//      the unified shell at apps/mobile/app/(app)/_layout.tsx is in
//      place.
//   7. packages/security re-exports checkActiveRole.
//   8. Every BFF service named in the contract validates the header:
//      family-svc, learning-svc, tutor-svc, billing-svc, engagement-svc,
//      comms-svc.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

const errors = [];
const warnings = [];

const HEADER_LITERAL = '"x-aivo-active-role"';

function readOrError(relPath) {
  const abs = join(repoRoot, relPath);
  if (!existsSync(abs)) {
    errors.push(`${relPath} missing.`);
    return null;
  }
  return readFileSync(abs, "utf8");
}

function mustExport(
  src,
  file,
  exportName,
  kindPattern = "(?:function|const|class|type|interface)",
) {
  const re = new RegExp(`export\\s+${kindPattern}\\s+${exportName}\\b`);
  if (!re.test(src)) {
    errors.push(`${file}: must export "${exportName}".`);
  }
}

// --- 1. active-role.ts ------------------------------------------------

const activeRoleRel = "apps/mobile/lib/active-role.ts";
const activeRoleSrc = readOrError(activeRoleRel);
if (activeRoleSrc) {
  mustExport(activeRoleSrc, activeRoleRel, "ACTIVE_ROLE_HEADER", "const");
  mustExport(activeRoleSrc, activeRoleRel, "setApiActiveRole", "function");
  mustExport(activeRoleSrc, activeRoleRel, "getApiActiveRole", "function");
  mustExport(activeRoleSrc, activeRoleRel, "applyActiveRoleHeader", "function");
  if (!activeRoleSrc.includes(`ACTIVE_ROLE_HEADER = ${HEADER_LITERAL}`)) {
    errors.push(
      `${activeRoleRel}: ACTIVE_ROLE_HEADER must equal ${HEADER_LITERAL} (contract: docs/mobile/unified-app-contract.md).`,
    );
  }
}

// --- 2. role-context.tsx ---------------------------------------------

const roleCtxRel = "apps/mobile/lib/role-context.tsx";
const roleCtxSrc = readOrError(roleCtxRel);
if (roleCtxSrc) {
  mustExport(roleCtxSrc, roleCtxRel, "RoleProvider", "function");
  mustExport(roleCtxSrc, roleCtxRel, "useRole", "function");
  mustExport(roleCtxSrc, roleCtxRel, "ACTIVE_ROLE_HEADER", "const");
  mustExport(roleCtxSrc, roleCtxRel, "ActiveLearnerContext", "type");
  mustExport(roleCtxSrc, roleCtxRel, "RoleContextValue", "interface");
  if (!roleCtxSrc.includes(`ACTIVE_ROLE_HEADER = ${HEADER_LITERAL}`)) {
    errors.push(
      `${roleCtxRel}: ACTIVE_ROLE_HEADER must equal ${HEADER_LITERAL} (must match ${activeRoleRel}).`,
    );
  }

  // --- 3. RoleContextValue shape -----------------------------------
  const shapeBlock = roleCtxSrc.match(/interface RoleContextValue\s*\{([\s\S]*?)\n\}/);
  if (!shapeBlock) {
    errors.push(`${roleCtxRel}: RoleContextValue interface body not found.`);
  } else {
    const body = shapeBlock[1];
    const REQUIRED_FIELDS = [
      "availableRoles",
      "activeRole",
      "setActiveRole",
      "lastPathByRole",
      "rememberPath",
      "activeLearner",
      "setActiveLearner",
    ];
    for (const field of REQUIRED_FIELDS) {
      // Match `field:` for properties and `field(` for method-style signatures.
      const re = new RegExp(`\\b${field}\\s*[(:]`);
      if (!re.test(body)) {
        errors.push(`${roleCtxRel}: RoleContextValue missing field "${field}".`);
      }
    }
  }

  // setActiveRole must reject roles outside availableRoles. We accept the
  // current implementation pattern: a throw inside the setter referencing
  // availableRoles.includes.
  if (!/availableRoles\.includes\(role\)/.test(roleCtxSrc) || !/throw new Error/.test(roleCtxSrc)) {
    errors.push(
      `${roleCtxRel}: setActiveRole must throw when the role is not in availableRoles (contract: docs/mobile/unified-app-contract.md "State invariants").`,
    );
  }
}

// --- 4. api.ts wiring -------------------------------------------------

const apiRel = "apps/mobile/lib/api.ts";
const apiSrc = readOrError(apiRel);
if (apiSrc) {
  if (!/from\s+["']\.\/active-role["']/.test(apiSrc)) {
    errors.push(`${apiRel}: must import from "./active-role".`);
  }
  if (
    !/\bimport\s*\{[^}]*\bapplyActiveRoleHeader\b[^}]*\}\s*from\s+["']\.\/active-role["']/.test(
      apiSrc,
    )
  ) {
    errors.push(`${apiRel}: must import applyActiveRoleHeader from "./active-role".`);
  }
  // Must actually be invoked inside apiFetch (string-level check is enough —
  // a real call site, not just an unused import).
  const apiFetchMatch = apiSrc.match(/export\s+async\s+function\s+apiFetch[\s\S]*?\n\}/);
  if (!apiFetchMatch) {
    errors.push(`${apiRel}: apiFetch export not found.`);
  } else if (!/applyActiveRoleHeader\s*\(/.test(apiFetchMatch[0])) {
    errors.push(
      `${apiRel}: apiFetch must call applyActiveRoleHeader so every authenticated request carries x-aivo-active-role.`,
    );
  }
}

// --- 5. feature-flags.ts ---------------------------------------------

const flagsRel = "apps/mobile/lib/feature-flags.ts";
const flagsSrc = readOrError(flagsRel);
let flagDefault = null; // true | false | null
if (flagsSrc) {
  if (!/MOBILE_UNIFIED_APP\s*:/.test(flagsSrc)) {
    errors.push(`${flagsRel}: MOBILE_UNIFIED_APP not declared.`);
  }
  if (!/EXPO_PUBLIC_MOBILE_UNIFIED_APP/.test(flagsSrc)) {
    errors.push(
      `${flagsRel}: MOBILE_UNIFIED_APP must be sourced from EXPO_PUBLIC_MOBILE_UNIFIED_APP.`,
    );
  }
  const defaultMatch = flagsSrc.match(
    /MOBILE_UNIFIED_APP\s*:\s*parseBoolEnv\([^,]+,\s*(true|false)\s*\)/,
  );
  if (defaultMatch) flagDefault = defaultMatch[1] === "true";
}

// --- 6. Legacy / unified mutual exclusion ----------------------------

const LEGACY_ROLE_GROUPS = ["(parent)", "(learner)", "(teacher)", "(caregiver)", "(therapist)"];
const legacyPresence = new Map();
for (const g of LEGACY_ROLE_GROUPS) {
  legacyPresence.set(g, existsSync(join(repoRoot, "apps/mobile/app", g)));
}
const unifiedShellPath = "apps/mobile/app/(app)/_layout.tsx";
const unifiedShellPresent = existsSync(join(repoRoot, unifiedShellPath));

if (flagDefault === false) {
  // Sprint 09 window: all 5 legacy groups must still exist.
  const missing = LEGACY_ROLE_GROUPS.filter((g) => !legacyPresence.get(g));
  if (missing.length > 0) {
    errors.push(
      `MOBILE_UNIFIED_APP default is false but the following legacy role groups are gone: ${missing.join(", ")}. Either restore them or flip the default to true once the unified shell is parity-complete.`,
    );
  }
  if (unifiedShellPresent) {
    warnings.push(
      `MOBILE_UNIFIED_APP default is false but ${unifiedShellPath} exists. That's fine pre-flip, but make sure it isn't reachable from the router until the flag flips.`,
    );
  }
} else if (flagDefault === true) {
  // Sprint 09b/c completed: all 5 legacy groups must be gone, unified shell present.
  const stillPresent = LEGACY_ROLE_GROUPS.filter((g) => legacyPresence.get(g));
  if (stillPresent.length > 0) {
    errors.push(
      `MOBILE_UNIFIED_APP default is true but legacy role groups still exist: ${stillPresent.join(", ")}. Delete them in the same commit that flips the flag (contract: Sprint 09b/c).`,
    );
  }
  if (!unifiedShellPresent) {
    errors.push(
      `MOBILE_UNIFIED_APP default is true but ${unifiedShellPath} is missing. The unified shell must exist when the flag is on.`,
    );
  }
}

// --- 7. @aivo/security exports checkActiveRole ----------------------

const securityIndexRel = "packages/security/src/index.ts";
const securitySrc = readOrError(securityIndexRel);
if (securitySrc) {
  if (!/\bcheckActiveRole\b/.test(securitySrc)) {
    errors.push(`${securityIndexRel}: must re-export checkActiveRole.`);
  }
  if (!/\bACTIVE_ROLE_HEADER\b/.test(securitySrc)) {
    errors.push(`${securityIndexRel}: must re-export ACTIVE_ROLE_HEADER.`);
  }
}

// --- 8. BFF services consume the header -----------------------------

const REQUIRED_SERVICES = [
  "family-svc",
  "learning-svc",
  "tutor-svc",
  "billing-svc",
  "engagement-svc",
  "comms-svc",
];
import("node:fs").then(({ readdirSync, statSync }) => {
  for (const svc of REQUIRED_SERVICES) {
    const svcRoot = join(repoRoot, "services", svc, "src");
    if (!existsSync(svcRoot)) {
      errors.push(`services/${svc}/src missing — required active-role consumer.`);
      continue;
    }
    let found = false;
    const stack = [svcRoot];
    while (stack.length > 0 && !found) {
      const dir = stack.pop();
      let entries;
      try {
        entries = readdirSync(dir);
      } catch {
        continue;
      }
      for (const entry of entries) {
        const abs = join(dir, entry);
        let st;
        try {
          st = statSync(abs);
        } catch {
          continue;
        }
        if (st.isDirectory()) {
          stack.push(abs);
        } else if (entry.endsWith(".ts")) {
          const src = readFileSync(abs, "utf8");
          if (/\bcheckActiveRole\s*\(/.test(src) && /\bACTIVE_ROLE_HEADER\b/.test(src)) {
            found = true;
            break;
          }
        }
      }
    }
    if (!found) {
      errors.push(
        `services/${svc}: no file calls checkActiveRole(req.headers[ACTIVE_ROLE_HEADER]). Every BFF named in docs/mobile/unified-app-contract.md must validate the active-role hint server-side.`,
      );
    }
  }

  // --- Report ---------------------------------------------------------
  if (warnings.length) {
    for (const w of warnings) console.warn(`warn: ${w}`);
  }
  if (errors.length) {
    for (const e of errors) console.error(`error: ${e}`);
    console.error(`\nmobile:role-audit FAILED with ${errors.length} error(s).`);
    process.exit(1);
  }

  console.log(
    `mobile:role-audit OK — active-role helpers, RoleContext shape, apiFetch wiring, MOBILE_UNIFIED_APP=${flagDefault} consistency, and ${REQUIRED_SERVICES.length} BFF consumers verified.`,
  );
});
