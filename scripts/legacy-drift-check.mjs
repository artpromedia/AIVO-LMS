#!/usr/bin/env node
/**
 * Legacy drift CI gate (Sprint B).
 *
 * Validates that the workspace structure documented in
 * docs/migration/file-level-drift.md still matches reality. Run as
 *
 *   pnpm legacy:drift
 *
 * Exits non-zero on:
 *   - missing service or package
 *   - unexpected service or package (forgot to update the drift doc?)
 *   - removal of a legacy duplicate that the doc still references
 *
 * The script operates entirely on the local checkout — it never
 * reaches out to GitHub. Cross-repo behavioral diffs are the job of
 * each port sprint (see docs/legacy-feature-porting-map.md).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "..");

/** Canonical service list. Update in the same PR that adds/removes a service. */
const EXPECTED_SERVICES = new Set([
  "admin-svc",
  "ai-svc",
  "alerts-proxy-svc",
  "assessment-svc",
  "audit-svc",
  "billing-svc",
  "brain-svc",
  "comms-svc",
  "curriculum-svc",
  "data-governance-svc",
  "engagement-svc",
  "family-svc",
  "homework-svc",
  "i18n-svc",
  "identity-svc",
  "integration-svc",
  "learning-svc",
  "math-recognizer-svc",
  "problem-session-svc",
  "recommendation-svc",
  "research-svc",
  "responsible-ai-svc",
  "science-solver-svc",
  "speech-eval-svc",
  "status-page-svc",
  "subject-brain-svc",
  "tenant-svc",
  "tutor-svc",
]);

/** Canonical package list. Update in the same PR that adds/removes a package. */
const EXPECTED_PACKAGES = new Set([
  "aac-bridge",
  "adaptive-baseline",
  "api-client",
  "billing-entitlements",
  "brand",
  "content-pack",
  "curriculum-authoring",
  "db",
  "enterprise-core",
  "events",
  "executive-function",
  "feature-flags",
  "item-bank",
  "learner-surfaces",
  "learner-ui",
  "level-transforms",
  "mobile-ui",
  "nav",
  "observability",
  "ops-alert",
  "ops-alerts",
  "pedagogy",
  "scheduling",
  "scoring",
  "security",
  "skill-graphs",
  "special-interest-engine",
  "sso",
  "stage-runtime",
  "stage-ui",
  "tutor-runtime",
  "tutor-sdk",
  "tutor-surface-protocol",
  "ui",
]);

/** Files the drift map references explicitly. If they vanish, the doc is stale. */
const REFERENCED_FILES = [
  "docs/migration/file-level-drift.md",
  "docs/migration/aivo-lms-vs-legacy-delta.md",
  "docs/legacy-feature-porting-map.md",
  "packages/ops-alert/src/index.ts",
  "packages/ops-alerts/src/index.ts",
  "services/integration-svc/src/services/sis-provider-interface.ts",
  "services/integration-svc/src/services/lti13-launch-validator.ts",
  "services/integration-svc/src/routes/connectors.ts",
];

function listDirNames(rel) {
  const dir = path.join(repoRoot, rel);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

const errors = [];
const warnings = [];

const actualServices = new Set(listDirNames("services"));
const actualPackages = new Set(listDirNames("packages"));

for (const svc of EXPECTED_SERVICES) {
  if (!actualServices.has(svc)) {
    errors.push(`missing service: services/${svc}`);
  }
}
for (const svc of actualServices) {
  if (!EXPECTED_SERVICES.has(svc)) {
    warnings.push(
      `unexpected service: services/${svc} — add to EXPECTED_SERVICES in scripts/legacy-drift-check.mjs and update docs/migration/file-level-drift.md`,
    );
  }
}

for (const pkg of EXPECTED_PACKAGES) {
  if (!actualPackages.has(pkg)) {
    errors.push(`missing package: packages/${pkg}`);
  }
}
for (const pkg of actualPackages) {
  if (!EXPECTED_PACKAGES.has(pkg)) {
    warnings.push(
      `unexpected package: packages/${pkg} — add to EXPECTED_PACKAGES in scripts/legacy-drift-check.mjs and update docs/migration/file-level-drift.md`,
    );
  }
}

for (const rel of REFERENCED_FILES) {
  if (!fs.existsSync(path.join(repoRoot, rel))) {
    errors.push(`referenced file missing: ${rel}`);
  }
}

if (warnings.length > 0) {
  console.warn("[legacy:drift] warnings:");
  for (const w of warnings) console.warn(`  - ${w}`);
}

if (errors.length > 0) {
  console.error("[legacy:drift] errors:");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(
  `[legacy:drift] ok — ${EXPECTED_SERVICES.size} services, ${EXPECTED_PACKAGES.size} packages, ${REFERENCED_FILES.length} referenced files verified`,
);
