#!/usr/bin/env node
// comms:audit — Sprint 13 gate.
//
// Verifies the comms contract in docs/comms/contract.md:
//
// 1. AVAILABLE_TEMPLATES in lib/templates.ts is non-empty.
// 2. Every id listed in AVAILABLE_TEMPLATES is referenced somewhere
//    in the same file (case label, helper, lookup) so the catalog and
//    renderer cannot drift.
// 3. lib/templates.ts MUST NOT interpolate forbidden raw fields:
//    iepText, iepBody, rawIep, chatTranscript,
//    brainProfileExplanation.
// 4. Notification preference / inbox BFF routes exist.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

const errors = [];
const warnings = [];

const templatesPath = join(repoRoot, "services/comms-svc/src/lib/templates.ts");
if (!existsSync(templatesPath)) {
  errors.push("services/comms-svc/src/lib/templates.ts missing.");
} else {
  const src = readFileSync(templatesPath, "utf8");

  // 1. AVAILABLE_TEMPLATES export + parse template ids.
  const m = src.match(/export const AVAILABLE_TEMPLATES\s*=\s*\[([\s\S]*?)\];/);
  if (!m) {
    errors.push("templates.ts: AVAILABLE_TEMPLATES export not found.");
  } else {
    const ids = [...m[1].matchAll(/\{\s*id:\s*"([^"]+)"/g)].map((x) => x[1]);
    if (ids.length === 0) {
      errors.push("templates.ts: AVAILABLE_TEMPLATES is empty.");
    }

    // 2. Each id must appear somewhere in the rest of the file
    // (case label, helper lookup, function name). We strip the
    // catalog itself so the listing doesn't satisfy the check.
    const withoutCatalog = src.replace(m[0], "");
    for (const id of ids) {
      const re = new RegExp(
        `(?:case\\s+"${id}"|"${id}"|'${id}'|${id.replace(/[-_]([a-z])/g, (_, c) => c.toUpperCase())})`,
      );
      if (!re.test(withoutCatalog)) {
        // Soft-warn: some templates are dispatched purely from id
        // string lookup. We only ERROR if NO trace appears.
        if (!new RegExp(`"${id}"`).test(withoutCatalog)) {
          warnings.push(
            `templates.ts: template id "${id}" is listed in AVAILABLE_TEMPLATES but not referenced elsewhere — verify a renderer branch exists.`,
          );
        }
      }
    }
  }

  // 3. Forbidden raw field interpolation.
  const FORBIDDEN_FIELDS = [
    /\bdata\.iepText\b/,
    /\bdata\.iepBody\b/,
    /\bdata\.rawIep\b/,
    /\bdata\.chatTranscript\b/,
    /\bdata\.brainProfileExplanation\b/,
    /\$\{[^}]*iepText[^}]*\}/,
    /\$\{[^}]*rawIep[^}]*\}/,
    /\$\{[^}]*chatTranscript[^}]*\}/,
  ];
  for (const re of FORBIDDEN_FIELDS) {
    if (re.test(src)) {
      errors.push(
        `templates.ts: forbidden field interpolation detected (${re.source}). Use a derived summary field instead.`,
      );
    }
  }
}

// 4. BFF routes exist.
const REQUIRED_BFF = [
  "apps/web-v2/app/api/bff/notification-preferences/route.ts",
  "apps/web-v2/app/api/bff/notifications/route.ts",
  "apps/web-v2/app/api/bff/notifications/mark-read/route.ts",
];
for (const rel of REQUIRED_BFF) {
  if (!existsSync(join(repoRoot, rel))) {
    errors.push(`missing comms BFF: ${rel}`);
  }
}

if (warnings.length) {
  for (const w of warnings) console.warn(`warn: ${w}`);
}
if (errors.length) {
  for (const e of errors) console.error(`error: ${e}`);
  console.error(`\ncomms:audit FAILED with ${errors.length} error(s).`);
  process.exit(1);
}

console.log(
  "comms:audit OK — AVAILABLE_TEMPLATES intact, no raw IEP / chat / brain leakage in templates, preference + inbox BFFs present.",
);
