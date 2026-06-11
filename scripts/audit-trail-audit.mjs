#!/usr/bin/env node
/**
 * audit-trail:audit — Sprint B4 regression guard.
 *
 *  1. The producer client validates every emit against the canonical Zod
 *     schema (fail-loud in dev, mark-and-emit in prod) and ships the
 *     5-minute read-dedupe with tests.
 *  2. Sensitive READS are audited: the admin-svc ingest route exists,
 *     appends BOTH hash chains, and the PII detail pages actually call it.
 *  3. Districts can export AND verify their trail: identity-svc serves
 *     /api/district/activity/verify on top of the audited export, and the
 *     web-admin console renders export + verification.
 *  4. audit-svc's export is self-auditing and its verify is rangeable;
 *     tenant principals are force-scoped.
 *  5. Writer key-profile discipline: every appendAudit call site passes
 *     the table's FULL canonical key set (canonical JSON drops undefined
 *     keys, so a missing key silently changes the hash payload and the
 *     chain verifier could never recompute the row).
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];

function read(rel) {
  const abs = join(repoRoot, rel);
  if (!existsSync(abs)) {
    errors.push(`${rel}: required file missing`);
    return "";
  }
  return readFileSync(abs, "utf8");
}

function requireAll(rel, patterns) {
  const src = read(rel);
  if (!src) return;
  for (const [label, pattern] of patterns) {
    if (!pattern.test(src)) errors.push(`${rel}: missing ${label}`);
  }
}

// ── 1. validated emit + read dedupe ─────────────────────────────────────
requireAll("packages/audit-client/src/schema.ts", [
  ["canonical zod schema", /auditEventInputSchema\s*=\s*z\.object/],
  ["dot-namespaced action rule", /AUDIT_ACTION_PATTERN/],
  ["never-throws validator", /export function validateAuditEventInput/],
]);
requireAll("packages/audit-client/src/emit.ts", [
  ["emit-time validation", /validateAuditEventInput\(event\)/],
  ["fail-loud outside production", /AuditSchemaError\(verdict\.issues\)/],
  ["drop-never marker in production", /schema_violation:\s*true/],
]);
requireAll("packages/audit-client/src/read-dedupe.ts", [
  ["5-minute window constant", /READ_DEDUPE_WINDOW_MS = 5 \* 60 \* 1000/],
  ["per-(actor, resource) keying", /shouldEmit\(actorId, action, resourceType, resourceId\)/],
]);
requireAll("packages/audit-client/src/schema.test.ts", [
  ["prod mark-and-emit test", /marked schema_violation/],
]);
requireAll("packages/audit-client/src/read-dedupe.test.ts", [
  ["window-does-not-extend test", /does not extend the window/],
]);

// ── 2. sensitive READS land on both chains and pages emit them ──────────
requireAll("services/admin-svc/src/routes/audit.ts", [
  ["read-events ingest route", /\/api\/admin-svc\/audit-log\/read-events/],
  ["platform chain append", /appendAudit\(db, "admin_audit_log", adminAuditLog/],
  ["district chain append", /appendAudit\(db, "district_activity_log", districtActivityLog/],
  ["server-side dedupe", /readDedupe\.shouldEmit/],
  ["action allowlist", /admin\.user\.viewed/],
]);
requireAll("packages/admin-api/src/audit.ts", [
  ["page-side emitter", /export async function recordAdminReadEvents/],
  ["client-side dedupe", /readEventDedupe\.shouldEmit/],
]);
requireAll("apps/web-admin/app/platform/users/[id]/page.tsx", [
  ["user view audited", /admin\.user\.viewed/],
  ["linked learners audited", /admin\.learner\.viewed/],
]);
requireAll("apps/web-admin/app/platform/compliance/dsar/[id]/page.tsx", [
  ["dsar view audited", /admin\.dsar\.viewed/],
]);

// ── 3. district export + verify, end to end ─────────────────────────────
requireAll("services/identity-svc/src/routes/district.ts", [
  ["district verify route", /\/api\/district\/activity\/verify/],
  ["range verification helper", /verifyAuditChainRange\(db, "district_activity_log"/],
  ["audited export (platform trail)", /action: "DATA_EXPORT"/],
  ["audited export (district trail)", /"activity\.exported"/],
]);
requireAll("packages/db/src/audit-chain-verify.ts", [
  ["anchored range verify", /anchorHash/],
  ["writer profiles registry", /AUDIT_CHAIN_PROFILES/],
]);
requireAll("packages/db/src/__tests__/audit-chain-verify.test.ts", [
  ["tamper detection test", /detects a tampered payload field/],
  ["deleted-row detection test", /prevHash linkage break/],
]);
requireAll("apps/web-admin/app/district/audit/export/page.tsx", [
  ["CSV export affordance", /district-export-csv/],
  ["JSONL export affordance", /district-export-jsonl/],
  ["verify affordance", /district-verify/],
  ["plain-language chain explanation", /fingerprint/],
]);
requireAll("apps/web-admin/app/district/audit/page.tsx", [
  ["district trail reads tenant-scoped source", /listDistrictActivity/],
]);
// The old platform-permission lister must stay dead — district/school
// audit pages calling it could never return rows for their roles.
{
  const src = read("packages/admin-api/src/audit.ts");
  if (/export async function listAdminAuditLogs\s*\(/.test(src)) {
    errors.push(
      "packages/admin-api/src/audit.ts: legacy listAdminAuditLogs returned — district/school pages must use the tenant-scoped trail",
    );
  }
}

// ── 4. audit-svc canonical store contract ───────────────────────────────
requireAll("services/audit-svc/src/routes/events.ts", [
  ["self-auditing export", /action: "audit\.exported"/],
  ["audit before first byte", /appended BEFORE streaming/i],
  ["forced tenant scope", /filter\.tenantId = scope\.tenantId/],
  ["producer-only append", /service or platform principal required/],
  ["rangeable verify", /store\.verify\(from \|\| to \? \{ from, to \} : undefined\)/],
]);
requireAll("services/audit-svc/src/__tests__/events-routes.test.ts", [
  ["tenant isolation test", /district A cannot export district B/],
  ["self-audit test", /audit\.exported/],
]);

// ── 5. writer key-profile discipline on every appendAudit call site ─────
const CANONICAL_KEYS = {
  admin_audit_log: [
    "action",
    "actorId",
    "actorEmail",
    "actorRole",
    "onBehalfOfId",
    "resourceType",
    "resourceId",
    "details",
    "ipAddress",
    "userAgent",
    "tenantId",
  ],
  district_activity_log: [
    "tenantId",
    "action",
    "actorId",
    "actorName",
    "onBehalfOfId",
    "resourceType",
    "resourceId",
    "details",
  ],
};

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist" || entry.startsWith(".")) continue;
    const abs = join(dir, entry);
    const st = statSync(abs);
    if (st.isDirectory()) yield* walk(abs);
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.|\.spec\./.test(entry)) yield abs;
  }
}

for (const base of ["services", "packages"]) {
  for (const abs of walk(join(repoRoot, base))) {
    const src = readFileSync(abs, "utf8");
    for (const [tableName, keys] of Object.entries(CANONICAL_KEYS)) {
      const re = new RegExp(`appendAudit\\(\\s*\\w+,\\s*"${tableName}"`, "g");
      let match;
      while ((match = re.exec(src))) {
        const close = src.indexOf("});", match.index);
        const block = src.slice(match.index, close === -1 ? match.index + 1200 : close + 3);
        // Helper wrappers that spread a row object are exempt only if they
        // spread ...row — none exist today; explicit keys are the contract.
        const missing = keys.filter(
          (key) => !new RegExp(`[{,\\s]${key}\\s*[:,}]`).test(block),
        );
        if (missing.length > 0) {
          const rel = abs.slice(repoRoot.length + 1);
          const line = src.slice(0, match.index).split("\n").length;
          errors.push(
            `${rel}:${line}: appendAudit(${tableName}) omits key(s) ${missing.join(", ")} — pass the full canonical profile with explicit nulls (see docs/audit-event-taxonomy.md)`,
          );
        }
      }
    }
  }
}

// ── 6. taxonomy doc documents the read events + dedupe window ───────────
requireAll("docs/audit-event-taxonomy.md", [
  ["read-event vocabulary", /admin\.learner\.viewed/],
  ["documented dedupe window", /Dedupe window: 5 minutes/],
  ["writer profile rule", /Writer key profiles/],
]);

if (errors.length > 0) {
  console.error(`audit-trail:audit FAILED (${errors.length} problem(s)):\n`);
  for (const err of errors) console.error(`  ✗ ${err}`);
  process.exit(1);
}
console.log("audit-trail:audit OK — validated emit, read auditing, district export+verify, writer profiles.");
