#!/usr/bin/env node
// security:audit — Sprint GREEN-12 gate (Tier A).
//
// Verifies the application-security contract described in
// docs/security/threat-model.md and docs/security/soc2-readiness.md:
//
//   1. Secret scanning: `.gitleaks.toml` + `.github/workflows/secret-scan.yml`
//      present and the workflow invokes `gitleaks/gitleaks-action`.
//   2. CVE scanning: `.github/workflows/security-scan.yml` present and runs
//      `pnpm audit --audit-level=high` (covers `ci.yml` too — both pipelines
//      must enforce the bar).
//   3. Browser-security headers: `apps/web-v2/next.config.ts` declares the
//      required headers (X-Frame-Options DENY, X-Content-Type-Options
//      nosniff, Referrer-Policy strict-origin-when-cross-origin,
//      Permissions-Policy with disabled defaults, HSTS in production).
//   4. Surface-role cookie helpers: `packages/security/src/surface-cookie.ts`
//      exports `SURFACE_COOKIE_NAME` and `getSurfaceSecret` and refuses to
//      fall back to a dev value when `NODE_ENV === "production"`.
//   5. Security docs + runbooks present: threat-model, soc2-readiness,
//      incident-response, pentest report, secret-history-rotation runbook,
//      and incident-response runbook.
//
// This gate does NOT spawn `gitleaks`, `pnpm audit`, or `semgrep` directly —
// those live in their dedicated GitHub Actions workflows
// (`secret-scan.yml`, `security-scan.yml`, `ci.yml`) where they have a
// clean Linux environment, network access, and proper exit-code reporting.
// What we enforce here is that those workflows still exist and still run
// the required commands, plus the static surface that the workflows depend
// on (header config, cookie helpers, gitleaks config, docs).
//
// Out of scope (Tier B — tracked as follow-up):
//   - Encryption-at-rest verification across services.
//   - Key rotation drill execution.
//   - Backup/restore drill execution.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const errors = [];

function rel(p) {
  return p
    .replace(repoRoot + "\\", "")
    .replace(repoRoot + "/", "")
    .replaceAll("\\", "/");
}

function readOrFail(absPath, label) {
  if (!existsSync(absPath)) {
    errors.push(`${label}: missing ${rel(absPath)}`);
    return null;
  }
  return readFileSync(absPath, "utf8");
}

function requireAll(label, src, needles) {
  if (src == null) return;
  for (const needle of needles) {
    const ok = needle instanceof RegExp ? needle.test(src) : src.includes(needle);
    if (!ok) {
      errors.push(`${label}: missing required token ${String(needle)}`);
    }
  }
}

// ----- 1. Secret scanning ------------------------------------------

const gitleaksConfig = join(repoRoot, ".gitleaks.toml");
if (!existsSync(gitleaksConfig)) {
  errors.push("secret-scan: .gitleaks.toml missing.");
}

const secretScanWf = join(repoRoot, ".github/workflows/secret-scan.yml");
const secretScanSrc = readOrFail(secretScanWf, "secret-scan/workflow");
requireAll("secret-scan/workflow", secretScanSrc, [
  /gitleaks\/gitleaks-action@/,
  /config-path:\s*\.gitleaks\.toml/,
]);

// ----- 2. CVE scanning ---------------------------------------------

const securityScanWf = join(repoRoot, ".github/workflows/security-scan.yml");
const securityScanSrc = readOrFail(securityScanWf, "cve-scan/security-scan workflow");
requireAll("cve-scan/security-scan workflow", securityScanSrc, [/pnpm audit\s+--audit-level=high/]);

const ciWf = join(repoRoot, ".github/workflows/ci.yml");
const ciSrc = readOrFail(ciWf, "cve-scan/ci workflow");
requireAll("cve-scan/ci workflow", ciSrc, [/pnpm audit\s+--audit-level=high/]);

// ----- 3. Browser security headers ---------------------------------

const nextConfigPath = join(repoRoot, "apps/web-v2/next.config.ts");
const nextConfigSrc = readOrFail(nextConfigPath, "headers/next.config.ts");
requireAll("headers/next.config.ts", nextConfigSrc, [
  /"X-Frame-Options"[^}]*"DENY"/,
  /"X-Content-Type-Options"[^}]*"nosniff"/,
  /"Referrer-Policy"[^}]*"strict-origin-when-cross-origin"/,
  /"Permissions-Policy"/,
  /camera=\(\)/,
  /microphone=\(\)/,
  /geolocation=\(\)/,
  /"Strict-Transport-Security"/,
  /max-age=63072000/,
  /includeSubDomains/,
  // Sprint A3 (ZAP #65/#73)
  /"Cross-Origin-Opener-Policy"[^}]*"same-origin"/,
  /"Cross-Origin-Resource-Policy"[^}]*"same-origin"/,
  /poweredByHeader:\s*false/,
]);

// ----- 3b. CSP + CSRF wiring (Sprint A3) -----------------------------
// Both web apps must build a nonce CSP in middleware and route mutating
// requests through the same-origin CSRF guard. Static checks here; the
// behavioural contract lives in apps/web-v2/e2e/security-headers.playwright.ts.
for (const [app, cspImport, csrfImport] of [
  ["apps/web-v2", "@/lib/security/csp", "@/lib/bff/csrf"],
  ["apps/web-admin", "@/lib/security/csp", "@/lib/security/csrf"],
]) {
  const mwPath = join(repoRoot, app, "middleware.ts");
  const mwSrc = readOrFail(mwPath, `${app}/middleware.ts`);
  requireAll(`${app}/middleware.ts`, mwSrc, [
    new RegExp(`from "${cspImport.replace(/[/@]/g, (m) => "\\" + m)}"`),
    new RegExp(`from "${csrfImport.replace(/[/@]/g, (m) => "\\" + m)}"`),
    /buildCsp\(/,
    /checkSameOrigin\(/,
    /content-security-policy/i,
  ]);
}
const adminNextConfig = readOrFail(
  join(repoRoot, "apps/web-admin/next.config.ts"),
  "headers/web-admin next.config.ts",
);
requireAll("headers/web-admin next.config.ts", adminNextConfig, [
  /"Cross-Origin-Opener-Policy"[^}]*"same-origin"/,
  /"Cross-Origin-Resource-Policy"[^}]*"same-origin"/,
  /poweredByHeader:\s*false/,
]);

// ----- 4. Surface-role cookie helpers ------------------------------

const surfaceCookiePath = join(repoRoot, "packages/security/src/surface-cookie.ts");
const surfaceCookieSrc = readOrFail(surfaceCookiePath, "cookie/surface-cookie");
requireAll("cookie/surface-cookie", surfaceCookieSrc, [
  /export\s+const\s+SURFACE_COOKIE_NAME\s*=/,
  /export\s+function\s+getSurfaceSecret\b/,
  /NODE_ENV\s*===\s*"production"/,
]);

// ----- 5. Security docs + runbooks ---------------------------------

const requiredDocs = [
  "docs/security/threat-model.md",
  "docs/security/soc2-readiness.md",
  "docs/security/incident-response.md",
  "docs/security/pentest-2026-04.md",
  "docs/runbooks/incident-response.md",
  "docs/runbooks/secret-history-rotation.md",
];
for (const docRel of requiredDocs) {
  if (!existsSync(join(repoRoot, docRel))) {
    errors.push(`docs: ${docRel} missing.`);
  }
}

// ----- Report -------------------------------------------------------

if (errors.length > 0) {
  console.error("security:audit FAILED");
  for (const err of errors) console.error(" - " + err);
  process.exit(1);
}

console.log(
  "security:audit OK — gitleaks + secret-scan workflow, pnpm-audit in security-scan + ci workflows, web-v2 security headers (XFO/XCTO/Referrer/Permissions/HSTS), surface-role cookie helpers, and security docs/runbooks present.",
);
