#!/usr/bin/env node
/**
 * check-audited-writes (Sprint 14) — service write routes are audited by
 * default.
 *
 * Scans every services/<svc>/src/routes/** file. Each POST/PUT/PATCH/
 * DELETE route registration must live in a file that either:
 *   - calls an audit writer — `audited(` (packages/audit-client),
 *     `appendAudit(` (hash-chained @aivo/db writer), `logAuditEvent(`
 *     (admin-svc helper), or `emitFamilyAudit(` (family-svc helper); or
 *   - carries an `audit-exempt(<reason>)` marker comment explaining why
 *     the registration is not a data mutation (e.g. a compute endpoint
 *     that happens to use POST).
 *
 * Granularity is per FILE (registration counts vs audit evidence): a file
 * whose write-registration count exceeds its audit-call + exemption count
 * is non-compliant. scripts/ci/audited-writes-baseline.json freezes
 * today's non-compliant FILE count per service — the gate fails when any
 * service's count RISES (new unaudited writes), and the baseline only
 * ratchets down. family-svc is the reference adoption at zero.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const baselinePath = join(repoRoot, "scripts", "ci", "audited-writes-baseline.json");
const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));

const WRITE_RE = /\b(?:app|fastify|server)\.(post|put|patch|delete)\s*\(/g;
const AUDIT_RE = /\b(?:audited|appendAudit|logAuditEvent|emitFamilyAudit)\s*\(/g;
const EXEMPT_RE = /audit-exempt\(([^)]*)\)/g;

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    const st = statSync(abs);
    if (st.isDirectory()) yield* walk(abs);
    else if (/\.ts$/.test(entry) && !entry.endsWith(".d.ts") && !/\.test\.ts$/.test(entry)) {
      yield abs;
    }
  }
}

const servicesDir = join(repoRoot, "services");
const perService = {};
const offenders = {};

for (const svc of readdirSync(servicesDir)) {
  const routesDir = join(servicesDir, svc, "src", "routes");
  if (!existsSync(routesDir)) continue;
  let nonCompliant = 0;
  for (const file of walk(routesDir)) {
    const src = readFileSync(file, "utf8");
    const writes = [...src.matchAll(WRITE_RE)].length;
    if (writes === 0) continue;
    const audits = [...src.matchAll(AUDIT_RE)].length;
    const exemptions = [...src.matchAll(EXEMPT_RE)];
    for (const ex of exemptions) {
      if (!ex[1].trim()) {
        console.error(
          `check-audited-writes: empty audit-exempt() reason in ${relative(repoRoot, file)}`,
        );
        process.exit(1);
      }
    }
    if (audits + exemptions.length === 0) {
      nonCompliant += 1;
      (offenders[svc] ??= []).push(relative(repoRoot, file));
    }
  }
  perService[svc] = nonCompliant;
}

let failed = false;
for (const [svc, count] of Object.entries(perService)) {
  const allowed = baseline.services?.[svc];
  if (allowed === undefined) {
    if (count > 0) {
      console.error(
        `check-audited-writes FAILED — new service "${svc}" has ${count} unaudited write file(s) ` +
          "and no baseline entry. New services start audited (count 0).",
      );
      failed = true;
    }
    continue;
  }
  if (count > allowed) {
    console.error(
      `check-audited-writes FAILED — ${svc}: ${count} unaudited write file(s) (baseline ${allowed}).\n` +
        (offenders[svc] ?? []).map((f) => "  - " + f).join("\n") +
        "\nWrap the route's mutation in an audit call (audited()/appendAudit()/service helper) " +
        "or mark the registration with an `audit-exempt(<reason>)` comment.",
    );
    failed = true;
  } else if (count < allowed) {
    console.log(
      `check-audited-writes: ${svc} improved (${count} < baseline ${allowed}) — ` +
        "ratchet the baseline down in audited-writes-baseline.json.",
    );
  }
}

if (failed) process.exit(1);
console.log(
  `check-audited-writes OK (${Object.keys(perService).length} services scanned; ` +
    `family-svc non-compliant files: ${perService["family-svc"] ?? "n/a"}).`,
);
