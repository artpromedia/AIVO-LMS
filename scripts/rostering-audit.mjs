#!/usr/bin/env node
// rostering:audit — Sprint 12 gate.
//
// Verifies the rostering contract in docs/rostering/contract.md:
//
// 1. SisProvider interface in
//    services/integration-svc/src/services/sis-provider-interface.ts
//    still declares listSchools, listTeachers, listStudents,
//    listClasses, listEnrollments.
// 2. createCleverAdapterFromExport and createClassLinkAdapterFromExport
//    are still exported.
// 3. The standalone admin app foundation exists. Detailed rostering UI
//    pages are intentionally not required during the admin-host cutover;
//    the BFF/API contracts remain guarded separately.
// 4. integration-svc/src/index.ts re-exports the adapters (so a
//    consumer that imports from "@aivo/integration-svc" still works).

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

const errors = [];

function read(rel) {
  const full = join(repoRoot, rel);
  if (!existsSync(full)) {
    errors.push(`missing: ${rel}`);
    return null;
  }
  return readFileSync(full, "utf8");
}

const sisInterface = read("services/integration-svc/src/services/sis-provider-interface.ts");
if (sisInterface) {
  for (const fn of [
    "listSchools",
    "listTeachers",
    "listStudents",
    "listClasses",
    "listEnrollments",
  ]) {
    if (!new RegExp(`${fn}\\s*\\(`).test(sisInterface)) {
      errors.push(`SisProvider interface missing method ${fn}().`);
    }
  }
}

const cleverAdapter = read("services/integration-svc/src/services/clever-adapter.ts");
if (cleverAdapter && !/createCleverAdapterFromExport/.test(cleverAdapter)) {
  errors.push("clever-adapter.ts: must export createCleverAdapterFromExport(payload).");
}

const classlinkAdapter = read("services/integration-svc/src/services/classlink-adapter.ts");
if (classlinkAdapter && !/createClassLinkAdapterFromExport/.test(classlinkAdapter)) {
  errors.push("classlink-adapter.ts: must export createClassLinkAdapterFromExport(payload).");
}

const integrationIndex = read("services/integration-svc/src/index.ts");
if (integrationIndex) {
  for (const symbol of [
    "sis-provider-interface",
    "clever-adapter",
    "classlink-adapter",
    "lti13-launch-validator",
  ]) {
    if (!new RegExp(symbol).test(integrationIndex)) {
      errors.push(
        `services/integration-svc/src/index.ts: must re-export ${symbol} so external consumers still resolve.`,
      );
    }
  }
}

const REQUIRED_ADMIN_APP_FILES = [
  "apps/web-admin/app/layout.tsx",
  "apps/web-admin/app/page.tsx",
  "apps/web-admin/app/platform/page.tsx",
];
for (const rel of REQUIRED_ADMIN_APP_FILES) {
  if (!existsSync(join(repoRoot, rel))) {
    errors.push(`missing standalone admin app file: ${rel}`);
  }
}

// ── Sprint B5 — the SCIM provisioning path is part of the rostering
// contract: one roster-apply core, SCIM endpoints incl. class-group
// mapping with unmapped-group recording, the district token/review UI,
// conformance tests, and the IdP runbook.
const rosterCore = read("services/identity-svc/src/services/roster-core.ts");
if (rosterCore) {
  for (const symbol of [
    "applyUserUpsert",
    "applyUserDeactivate",
    "applyClassGroupMapping",
    "recordUnmappedGroup",
    "parseClassGroupName",
  ]) {
    if (!new RegExp(`export (async )?function ${symbol}`).test(rosterCore)) {
      errors.push(`roster-core.ts: missing export ${symbol} — the shared roster-apply core.`);
    }
  }
}

const scimRoutes = read("services/identity-svc/src/routes/scim.ts");
if (scimRoutes) {
  if (!/applyUserUpsert\(/.test(scimRoutes) || !/applyUserDeactivate\(/.test(scimRoutes)) {
    errors.push("scim.ts: user create/deactivate must apply through the shared roster core.");
  }
  if (/db\s*\.insert\(users\)/.test(scimRoutes)) {
    errors.push("scim.ts: direct users insert found — provisioning writes belong in roster-core.");
  }
  if (!/applyClassGroupMapping\(/.test(scimRoutes) || !/recordUnmappedGroup\(/.test(scimRoutes)) {
    errors.push("scim.ts: class-group mapping + unmapped-group recording are required.");
  }
}

const internalRoster = read("services/identity-svc/src/routes/internal-roster.ts");
if (internalRoster) {
  for (const route of ["/internal/roster/users/upsert", "/internal/roster/users/deactivate"]) {
    if (!internalRoster.includes(route)) {
      errors.push(`internal-roster.ts: missing ${route} (the SIS pipeline writer's contract).`);
    }
  }
}

const scimSection = read("apps/web-admin/app/district/sis/scim-section.tsx");
if (scimSection) {
  for (const [label, pattern] of [
    ["once-only plaintext display", /scim-token-plaintext/],
    ["token revoke action", /scim-token-revoke/],
    ["sync counters", /scim-counters/],
    ["unmapped-group review list", /scim-unmapped/],
  ]) {
    if (!pattern.test(scimSection)) errors.push(`scim-section.tsx: missing ${label}.`);
  }
}

const conformance = read("services/identity-svc/tests/scim-conformance.test.ts");
if (conformance) {
  for (const [label, pattern] of [
    ["Okta lifecycle test", /Okta lifecycle/],
    ["Entra lifecycle test", /Entra lifecycle/],
    ["tenant isolation test", /tenant isolation/],
    ["unmapped recording test", /RECORDED, not dropped/],
    ["malformed PatchOp test", /malformed PatchOps are rejected/],
  ]) {
    if (!pattern.test(conformance)) errors.push(`scim-conformance.test.ts: missing ${label}.`);
  }
}

if (!existsSync(join(repoRoot, "docs/integrations/scim-runbook.md"))) {
  errors.push("missing docs/integrations/scim-runbook.md (Okta + Entra setup runbook).");
}

if (errors.length) {
  for (const e of errors) console.error(`error: ${e}`);
  console.error(`\nrostering:audit FAILED with ${errors.length} error(s).`);
  process.exit(1);
}

console.log(
  "rostering:audit OK — SisProvider interface, Clever + ClassLink adapters, integration-svc re-exports, admin app foundation, and the SCIM provisioning path (roster core, class-group mapping, district UI, conformance tests, runbook) verified.",
);
