#!/usr/bin/env node
// Verifies the AIVO_LMS workspace shape that the migration plan depends on.
// Exit non-zero if a required app, package, or service is missing, or if a
// required script is not declared in the root package.json.
//
// Sprint 00 ownership. Update this script when adding/removing workspaces
// that the completion roadmap depends on.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

// `apps/web` was retired in commit 6f30f5d — `apps/web-v2` is the
// canonical learner/parent surface going forward.
const REQUIRED_APPS = ["marketing", "mobile", "web-v2"];

const REQUIRED_PACKAGES = [
  "aac-bridge",
  "adaptive-baseline",
  "api-client",
  "audit-client",
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
  "learner-import",
  "learner-surfaces",
  "learner-ui",
  "level-transforms",
  "mobile-ui",
  "nav",
  "observability",
  "ops-alert",
  "ops-alerts",
  "otel-bootstrap",
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
];

const REQUIRED_SERVICES = [
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
  "integrations-svc",
  "learning-svc",
  "math-recognizer-svc",
  "problem-session-svc",
  "recommendation-svc",
  "reports-svc",
  "research-svc",
  "responsible-ai-svc",
  "science-solver-svc",
  "speech-eval-svc",
  "status-page-svc",
  "subject-brain-svc",
  "tenant-svc",
  "tutor-svc",
];

const REQUIRED_ROOT_SCRIPTS = [
  "dev",
  "build",
  "lint",
  "test",
  "prod:check",
  "prod:no-demo",
  "prod:surface-contract",
  "test:production-readiness",
  "test:enterprise",
  "test:integration",
  "api:dump",
  "api:generate",
  "api:check",
  "i18n:audit",
  "format",
  "format:check",
  "repo:health",
];

const REQUIRED_ROOT_DOCS = [
  "docs/migration/aivo-lms-vs-legacy-delta.md",
  "docs/migration/completion-roadmap.md",
  "docs/enterprise-release-gates.md",
  "docs/production-readiness-gates.md",
  "docs/release-blockers.md",
];

const errors = [];
const warnings = [];

function checkDir(label, root, names) {
  const present = new Set(
    existsSync(root)
      ? readdirSync(root).filter((n) => {
          try {
            return statSync(join(root, n)).isDirectory();
          } catch {
            return false;
          }
        })
      : [],
  );
  for (const name of names) {
    if (!present.has(name)) {
      errors.push(`missing ${label}: ${name}`);
    }
  }
  // Surface unknown ones as warnings, not errors — extra workspaces are
  // expected at various points in the roadmap (e.g. integrations-svc
  // duplication is tracked for Sprint 02).
  for (const name of present) {
    if (!names.includes(name)) {
      warnings.push(`unexpected ${label}: ${name}`);
    }
  }
}

function checkRootScripts() {
  const pkgPath = join(repoRoot, "package.json");
  if (!existsSync(pkgPath)) {
    errors.push("missing root package.json");
    return;
  }
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  const scripts = pkg.scripts ?? {};
  for (const name of REQUIRED_ROOT_SCRIPTS) {
    if (!(name in scripts)) {
      errors.push(`missing root script: ${name}`);
    }
  }
  if (pkg.packageManager && !pkg.packageManager.startsWith("pnpm@10.")) {
    warnings.push(`packageManager is ${pkg.packageManager}; roadmap pins pnpm@10.26.1`);
  }
  const nodeEngine = pkg.engines?.node ?? "";
  if (!nodeEngine.includes(">=22")) {
    warnings.push(`engines.node is "${nodeEngine}"; roadmap requires >=22`);
  }
}

function checkDocs() {
  for (const rel of REQUIRED_ROOT_DOCS) {
    if (!existsSync(join(repoRoot, rel))) {
      errors.push(`missing doc: ${rel}`);
    }
  }
}

function checkWorkspaceManifest() {
  const wsPath = join(repoRoot, "pnpm-workspace.yaml");
  if (!existsSync(wsPath)) {
    errors.push("missing pnpm-workspace.yaml");
    return;
  }
  const ws = readFileSync(wsPath, "utf8");
  for (const expected of ["apps/*", "packages/*", "services/*"]) {
    if (!ws.includes(expected)) {
      errors.push(`pnpm-workspace.yaml missing pattern: ${expected}`);
    }
  }
}

checkDir("apps", join(repoRoot, "apps"), REQUIRED_APPS);
checkDir("packages", join(repoRoot, "packages"), REQUIRED_PACKAGES);
checkDir("services", join(repoRoot, "services"), REQUIRED_SERVICES);
checkRootScripts();
checkDocs();
checkWorkspaceManifest();

if (warnings.length) {
  for (const w of warnings) console.warn(`warn: ${w}`);
}
if (errors.length) {
  for (const e of errors) console.error(`error: ${e}`);
  console.error(`\nrepo:health FAILED with ${errors.length} error(s).`);
  process.exit(1);
}

console.log(
  `repo:health OK — ${REQUIRED_APPS.length} apps, ${REQUIRED_PACKAGES.length} packages, ${REQUIRED_SERVICES.length} services, ${REQUIRED_ROOT_SCRIPTS.length} root scripts verified.`,
);
