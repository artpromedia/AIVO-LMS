#!/usr/bin/env node
// backend:parity — Sprint GREEN-01 gate.
//
// Verifies that each domain-bearing service in services/* has the minimum
// production stack the sprint requires: routes, persistence, auth/role
// scoping, tenant isolation, audit logging where applicable, and tests.
//
// Rule (from sprint prompt):
//   "A feature is green only when it has real persistence, route behavior,
//    tests, and production guards. TypeScript types are not enough."
//
// This script does not run the services. It greps source. Greps can have
// false negatives, so every check is documented and the matrix in
// docs/quality/backend-parity-matrix.md is the human-readable truth — this
// script is the machine-readable enforcement.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const servicesRoot = join(repoRoot, "services");

// --- service contract --------------------------------------------------------
//
// For each service we declare which guards are *required*. A service that
// touches learner / parent / IEP / billing / consent data must have auth,
// tenant, and audit. A pure inference service can be more lenient. A
// service marked `unsafe: false` means "this service may be sensitive but
// we haven't authored its contract yet" — and it fails red until someone
// authors it.
//
// Status legend in matrix output:
//   green   - all required guards satisfied + tests
//   yellow  - guards satisfied but tests missing
//   red     - missing one or more required guards
//   excluded - explicitly out of scope with documented reason

const SERVICE_CONTRACTS = {
  // sensitive data planes — must have auth + tenant + audit + tests
  "identity-svc": {
    sensitive: true,
    needAuth: true,
    needTenant: true,
    needAudit: true,
    needDb: true,
    needTests: true,
    domain: "Identity / auth",
  },
  "family-svc": {
    sensitive: true,
    needAuth: true,
    needTenant: true,
    needAudit: true,
    needDb: true,
    needTests: true,
    domain: "Parent + learner profile",
  },
  // tenant-svc IS the tenant authority — its routes operate on Tenant
  // objects directly (create / list / update tenants for platform admins)
  // rather than scoping queries by tenantId. needTenant relaxed by design.
  "tenant-svc": {
    sensitive: true,
    needAuth: true,
    needTenant: false,
    needAudit: true,
    needDb: false,
    needTests: true,
    domain: "Tenant + org (platform authority)",
  },
  "brain-svc": {
    sensitive: true,
    needAuth: true,
    needTenant: true,
    needAudit: true,
    needDb: true,
    needTests: true,
    domain: "Brain profile",
  },
  // subject-brain-svc is a pure-compute stateless reasoner that builds
  // a per-learner subject context (skill graph traversal, profile
  // adaptations). No DB, no mutation, no audit emission — the caller
  // (brain-svc / tutor-svc) is already authenticated and tenant-scoped
  // and is the one that persists / audits the resulting context.
  "subject-brain-svc": {
    sensitive: true,
    needAuth: true,
    needTenant: false,
    needAudit: false,
    needDb: false,
    needTests: true,
    domain: "Subject brain (stateless reasoner)",
  },
  "assessment-svc": {
    sensitive: true,
    needAuth: true,
    needTenant: true,
    needAudit: true,
    needDb: true,
    needTests: true,
    domain: "Baseline + assessment",
  },
  "learning-svc": {
    sensitive: true,
    needAuth: true,
    needTenant: true,
    needAudit: true,
    needDb: true,
    needTests: true,
    domain: "LessonRun + Today's Mission",
  },
  "tutor-svc": {
    sensitive: true,
    needAuth: true,
    needTenant: true,
    needAudit: true,
    needDb: true,
    needTests: true,
    domain: "Tutor runtime",
  },
  "homework-svc": {
    sensitive: true,
    needAuth: true,
    needTenant: true,
    needAudit: true,
    needDb: true,
    needTests: true,
    domain: "Homework Helper",
  },
  "comms-svc": {
    sensitive: true,
    needAuth: true,
    needTenant: true,
    needAudit: true,
    needDb: true,
    needTests: true,
    domain: "Notifications",
  },
  "billing-svc": {
    sensitive: true,
    needAuth: true,
    needTenant: true,
    needAudit: true,
    needDb: true,
    needTests: true,
    domain: "Billing + entitlements",
  },
  "audit-svc": {
    sensitive: true,
    needAuth: true,
    needTenant: true,
    needAudit: true,
    needDb: true,
    needTests: true,
    domain: "Audit log persistence",
  },
  "data-governance-svc": {
    sensitive: true,
    needAuth: true,
    needTenant: true,
    needAudit: true,
    needDb: true,
    needTests: true,
    domain: "DSAR / export / delete",
  },
  "admin-svc": {
    sensitive: true,
    needAuth: true,
    needTenant: true,
    needAudit: true,
    needDb: true,
    needTests: true,
    domain: "Admin console BFF",
  },
  // curriculum-svc serves the SHARED CCSS / NGSS / state-standards
  // catalog — the same skill graph and content packs are returned for
  // every tenant. There is no per-tenant data, so tenant scoping is
  // not applicable. Auth is still required (already wired) to keep the
  // catalog from being scraped anonymously.
  "curriculum-svc": {
    sensitive: true,
    needAuth: true,
    needTenant: false,
    needAudit: false,
    needDb: false,
    needTests: true,
    domain: "Curriculum + standards (shared catalog)",
  },
  "recommendation-svc": {
    sensitive: true,
    needAuth: true,
    needTenant: true,
    needAudit: false,
    needDb: false,
    needTests: true,
    domain: "Recommendation",
  },
  "engagement-svc": {
    sensitive: true,
    needAuth: true,
    needTenant: true,
    needAudit: false,
    needDb: true,
    needTests: true,
    domain: "Engagement metrics",
  },
  "problem-session-svc": {
    sensitive: true,
    needAuth: true,
    needTenant: true,
    needAudit: false,
    needDb: false,
    needTests: true,
    domain: "Problem session ledger",
  },
  // responsible-ai-svc is a pure-compute evaluator (no DB, no tenant
  // persistence). It is called by tutor-svc / learning-svc / ai-svc
  // which have already authenticated and scoped to a tenant. Audit
  // emission IS required — every block decision must land in the
  // hash-chained log.
  "responsible-ai-svc": {
    sensitive: true,
    needAuth: true,
    needTenant: false,
    needAudit: true,
    needDb: false,
    needTests: true,
    domain: "Responsible AI / safety (evaluator)",
  },
  "ai-svc": {
    sensitive: true,
    needAuth: true,
    needTenant: true,
    needAudit: true,
    needDb: false,
    needTests: true,
    domain: "AI provider abstraction",
  },

  // inference / integration / utility planes
  "integration-svc": {
    sensitive: true,
    needAuth: true,
    needTenant: true,
    needAudit: false,
    needDb: false,
    needTests: true,
    domain: "External integrations",
  },
  "integrations-svc": {
    sensitive: true,
    needAuth: true,
    needTenant: true,
    needAudit: false,
    needDb: true,
    needTests: true,
    domain: "External integrations (alt)",
  },
  "research-svc": {
    sensitive: false,
    needAuth: true,
    needTenant: false,
    needAudit: false,
    needDb: true,
    needTests: true,
    domain: "Research / analytics",
  },
  "status-page-svc": {
    sensitive: false,
    needAuth: false,
    needTenant: false,
    needAudit: false,
    needDb: false,
    needTests: false,
    domain: "Public status page (stateless)",
  },
  "alerts-proxy-svc": {
    sensitive: false,
    needAuth: true,
    needTenant: false,
    needAudit: false,
    needDb: false,
    needTests: true,
    domain: "Ops alerts proxy",
  },
  "math-recognizer-svc": {
    sensitive: false,
    needAuth: true,
    needTenant: false,
    needAudit: false,
    needDb: false,
    needTests: true,
    domain: "Math recognizer (inference)",
  },
  "science-solver-svc": {
    sensitive: false,
    needAuth: true,
    needTenant: false,
    needAudit: false,
    needDb: false,
    needTests: true,
    domain: "Science solver (inference)",
  },
  "i18n-svc": {
    sensitive: false,
    needAuth: false,
    needTenant: false,
    needAudit: false,
    needDb: true,
    needTests: false,
    domain: "i18n catalog",
  },
};

// --- helpers -----------------------------------------------------------------

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist" || name === ".turbo") continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (st.isFile()) out.push(full);
  }
  return out;
}

function readSafe(p) {
  try {
    return readFileSync(p, "utf8");
  } catch {
    return "";
  }
}

const AUTH_RE =
  /\b(authenticate(?:Request)?|requireAuth|verifyToken|verifyJWT|verifyParentOwnership|requireUser|requireRole|jwtVerify|HTTPBearer|require_auth|require_user|require_session|OAuth2PasswordBearer|@aivo\/sso|@aivo\/security|@aivo\/enterprise-core|withAuth|getServerSession|HTTPAuthorizationCredentials|requirePlatformAdmin|requireDistrictAdmin|requireSchoolAdmin|requireParent|requireTeacher|requireLearner|requireStaff|requireSubject|requireScope|requirePermission|requireGuardian|requireSession|fastifyAuth|requiresAuth|registerEnterpriseAuthHook|enterpriseAuthHook|registerAuthHook|requireServiceToken|INTERNAL_SERVICE_TOKEN|EXPECTED_SERVICE_TOKEN|x-service-token)\b/;
const TENANT_RE =
  /\b(tenantId|tenant_id|requireTenant|tenantContext|withTenant|tenant_context|getTenant|TenantContext)\b/;
const AUDIT_RE =
  /\b(logAuditEvent|emitAudit|audit-svc|audit_svc|writeAuditEvent|auditEvent|auditEvents|recordAudit|aivoAudit|audit\.write|audit\.log|appendAudit|emitBillingAudit|emit[A-Z]\w*Audit|adminAuditLog|admin_audit_log|district_activity_log)\b/;
const DB_RE = /(@aivo\/db|drizzle|from\s+["']\.\.\/db|alembic|sqlalchemy|psycopg|postgres)/;
const ROUTE_TS_RE = /\b(router|app|fastify|server)\.(get|post|put|delete|patch)\(/;
const ROUTE_PY_RE = /@(router|app)\.(get|post|put|delete|patch)\(|APIRouter\(/;
const SUSPICIOUS_RE =
  /(TODO production blocker|throw new Error\(['"]not implemented['"]\)|MOCK_QUESTIONS|coming soon|placeholder for production|STUB_|return\s+\{\s*ok:\s*true\s*\}\s*;\s*\/\/\s*todo)/i;

function inspectService(name, contract) {
  const dir = join(servicesRoot, name);
  const files = walk(dir).filter(
    (p) => /\.(ts|tsx|js|mjs|py)$/.test(p) && !p.includes("/dist/") && !p.endsWith(".d.ts"),
  );
  if (files.length === 0) {
    return { name, contract, missing: true };
  }
  const blob = files.map((p) => `\n// ${p}\n` + readSafe(p)).join("\n");
  const testFiles = files.filter(
    (p) =>
      (/(__tests__|\.test\.|_test\.py)/.test(p) ||
        /\/tests?\/(?!integration\/).*\/?test_[^/]+\.py$/.test(p) ||
        /\/tests?\/test_[^/]+\.py$/.test(p)) &&
      !p.includes("/integration/"),
  );
  const routeFiles = files.filter(
    (p) => ROUTE_TS_RE.test(readSafe(p)) || ROUTE_PY_RE.test(readSafe(p)),
  );
  const hasAuth = AUTH_RE.test(blob);
  const hasTenant = TENANT_RE.test(blob);
  const hasAudit = AUDIT_RE.test(blob);
  const hasDb = DB_RE.test(blob);
  const suspicious = [];
  for (const f of files) {
    // Skip test files — `stub_` / `mock_` etc. are standard mocking
    // idioms in tests and aren't production-code findings.
    if (/(__tests__|\.test\.|_test\.py|^test_|\/tests\/)/.test(f)) continue;
    const src = readSafe(f);
    const m = src.match(SUSPICIOUS_RE);
    if (m) suspicious.push(`${f.replace(repoRoot + "/", "")}: ${m[0].slice(0, 60)}`);
  }
  // integration tests under tests/integration/**
  const integrationDir = join(repoRoot, "tests/integration");
  let hasIntegration = false;
  if (existsSync(integrationDir)) {
    const integFiles = walk(integrationDir).filter((p) => /\.(ts|js|mjs|py)$/.test(p));
    const integBlob = integFiles.map((p) => readSafe(p)).join("\n");
    hasIntegration = new RegExp(`${name}|@aivo/${name}`).test(integBlob);
  }
  return {
    name,
    contract,
    routes: routeFiles.length,
    tests: testFiles.length,
    hasAuth,
    hasTenant,
    hasAudit,
    hasDb,
    hasIntegration,
    suspicious,
  };
}

// --- run ---------------------------------------------------------------------

const services = Object.keys(SERVICE_CONTRACTS).sort();
const reports = services.map((n) => inspectService(n, SERVICE_CONTRACTS[n]));

const errors = [];
const warnings = [];
const rows = [];

for (const r of reports) {
  if (r.missing) {
    errors.push(`${r.name}: service directory not found or empty`);
    rows.push({
      name: r.name,
      status: "🔴 missing",
      domain: r.contract.domain,
      detail: "no source files",
    });
    continue;
  }
  const c = r.contract;
  const failures = [];
  if (c.needAuth && !r.hasAuth) failures.push("no-auth");
  if (c.needTenant && !r.hasTenant) failures.push("no-tenant");
  if (c.needAudit && !r.hasAudit) failures.push("no-audit");
  if (c.needDb && !r.hasDb) failures.push("no-db");
  if (r.routes === 0 && c.sensitive) failures.push("no-routes");
  if (c.needTests && r.tests === 0) failures.push("no-unit-tests");
  if (c.sensitive && !r.hasIntegration && c.needTests)
    warnings.push(`${r.name}: no integration test references in tests/integration/**`);
  if (r.suspicious.length) failures.push(`suspicious(${r.suspicious.length})`);

  let status;
  if (failures.length === 0) {
    status = "🟢 green";
  } else if (failures.every((f) => f === "no-unit-tests" || f.startsWith("suspicious"))) {
    status = "🟡 yellow";
    for (const f of failures) warnings.push(`${r.name}: ${f}`);
  } else {
    status = "🔴 red";
    for (const f of failures) errors.push(`${r.name}: ${f}`);
  }
  rows.push({
    name: r.name,
    status,
    domain: c.domain,
    detail: `routes=${r.routes} tests=${r.tests} auth=${r.hasAuth ? "y" : "n"} tenant=${r.hasTenant ? "y" : "n"} audit=${r.hasAudit ? "y" : "n"} db=${r.hasDb ? "y" : "n"} integ=${r.hasIntegration ? "y" : "n"}`,
  });
}

// --- report ------------------------------------------------------------------

const pad = (s, n) => String(s).padEnd(n);
console.log("\nBACKEND PARITY MATRIX (machine check)\n");
console.log(pad("service", 22), pad("status", 12), pad("domain", 36), "detail");
console.log("-".repeat(140));
for (const r of rows) {
  console.log(pad(r.name, 22), pad(r.status, 12), pad(r.domain, 36), r.detail);
}
console.log("-".repeat(140));

const green = rows.filter((r) => r.status.includes("green")).length;
const yellow = rows.filter((r) => r.status.includes("yellow")).length;
const red = rows.filter((r) => r.status.includes("red") || r.status.includes("missing")).length;
console.log(`\nsummary: ${green} green, ${yellow} yellow, ${red} red, ${rows.length} total\n`);

if (warnings.length) {
  console.log(`warnings (${warnings.length}):`);
  for (const w of warnings) console.log(`  warn: ${w}`);
}
if (errors.length) {
  console.error(`\nerrors (${errors.length}):`);
  for (const e of errors) console.error(`  error: ${e}`);
  console.error("\nbackend:parity FAILED. See docs/quality/backend-parity-matrix.md.");
  process.exit(1);
}
console.log("backend:parity OK.");
