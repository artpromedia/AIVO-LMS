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
// 3. Admin school rostering pages exist.
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

const sisInterface = read(
  "services/integration-svc/src/services/sis-provider-interface.ts",
);
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

const cleverAdapter = read(
  "services/integration-svc/src/services/clever-adapter.ts",
);
if (cleverAdapter && !/createCleverAdapterFromExport/.test(cleverAdapter)) {
  errors.push(
    "clever-adapter.ts: must export createCleverAdapterFromExport(payload).",
  );
}

const classlinkAdapter = read(
  "services/integration-svc/src/services/classlink-adapter.ts",
);
if (
  classlinkAdapter &&
  !/createClassLinkAdapterFromExport/.test(classlinkAdapter)
) {
  errors.push(
    "classlink-adapter.ts: must export createClassLinkAdapterFromExport(payload).",
  );
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

const REQUIRED_ADMIN_PAGES = [
  "apps/web-v2/app/admin/school/rostering/page.tsx",
  "apps/web-v2/app/admin/school/rostering/import/page.tsx",
];
for (const rel of REQUIRED_ADMIN_PAGES) {
  if (!existsSync(join(repoRoot, rel))) {
    errors.push(`missing admin rostering page: ${rel}`);
  }
}

if (errors.length) {
  for (const e of errors) console.error(`error: ${e}`);
  console.error(`\nrostering:audit FAILED with ${errors.length} error(s).`);
  process.exit(1);
}

console.log(
  "rostering:audit OK — SisProvider interface, Clever + ClassLink adapter factories, integration-svc index re-exports, admin rostering pages verified.",
);
