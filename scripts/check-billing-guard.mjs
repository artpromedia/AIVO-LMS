#!/usr/bin/env node
/**
 * Sprint 6 — CI guard for billing/entitlement/session regressions.
 *
 * Scans the repo for forbidden patterns that would silently undo the
 * Sprint 1–5 work:
 *
 *   1. Fake payment-method ids constructed at runtime (`card_${Date.now()}`,
 *      `pm_${Date.now()}`, etc.). The only way a payment method should
 *      enter the system is via Stripe Checkout / Portal.
 *   2. Synthetic learner session ids (`/(learner)/stage/${slug}-session`).
 *      Mobile must navigate to a server-issued sessionId.
 *   3. TODO/FIXME/HACK comments in billing-, entitlement-, and
 *      session-critical files. The audit recommends these be replaced
 *      with tracked issues, not left as inline reminders.
 *   4. The legacy PLAN_INCLUDED_TUTORS literal that used to duplicate
 *      entitlement logic on the client. Apps must read entitlements
 *      from /api/billing/entitlements.
 *   5. Hard-coded `4242 4242 4242 4242` and friends in non-test paths.
 *
 * Exits non-zero with a summary of the violations. The allowlist is
 * intentionally narrow: real test fixtures live under tests/, e2e/,
 * services/billing-svc/tests/, packages/*​/tests/, and any *.test.* file.
 */
import { readFileSync, statSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

const SCAN_DIRS = ["apps", "services", "packages"];

const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  "dist-test",
  ".next",
  "build",
  "drizzle",
  "openapi",
]);

const TEST_PATH_RE = /(^|[\\/])(tests?|__tests__|e2e)[\\/]|[.]test[.]|[.]spec[.]/;

const RULES = [
  {
    name: "no-fake-payment-method-id",
    description:
      "Constructed payment-method-id strings (card_${...}, pm_${...}). Use Stripe Checkout/Portal instead.",
    re: /\b(card|pm)_\$\{[^}]+\}/g,
  },
  {
    name: "no-synthetic-session-id",
    description:
      "Mobile must navigate to a server-issued sessionId. The legacy ${slug}-session navigation pattern is banned.",
    re: /\(learner\)\/stage\/\$\{[A-Za-z_][A-Za-z_0-9.]*\}-session/g,
  },
  {
    name: "no-local-plan-included-tutors",
    description:
      "PLAN_INCLUDED_TUTORS / SKU_MAP literals duplicate billing-entitlements. Read /api/billing/entitlements instead.",
    re: /\bPLAN_INCLUDED_TUTORS\s*[:=]/g,
  },
  {
    name: "no-billing-todos",
    description:
      "TODO/FIXME/HACK left in billing/entitlement/session source files. File a tracked issue and remove the comment.",
    re: /\b(TODO|FIXME|HACK)\b[^\n]*/g,
    pathFilter: (rel) =>
      /(?:^|[\\/])billing(?:-svc)?[\\/]/.test(rel) ||
      /entitlement/.test(rel) ||
      /[\\/]routes[\\/]plans[.]ts$/.test(rel) ||
      /[\\/]routes[\\/]webhooks[.]ts$/.test(rel),
  },
  {
    name: "no-stripe-test-card-outside-tests",
    description:
      "The Stripe test card 4242 must only appear in tests, docs, or comments — never in shipped UI/source paths.",
    re: /\b4242\s*4242\s*4242\s*4242\b/g,
  },
];

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) yield* walk(full);
    else if (/\.(?:ts|tsx|js|mjs|cjs)$/.test(entry)) yield full;
  }
}

const violations = [];

for (const top of SCAN_DIRS) {
  const root = join(ROOT, top);
  let stat;
  try {
    stat = statSync(root);
  } catch {
    continue;
  }
  if (!stat.isDirectory()) continue;
  for (const file of walk(root)) {
    const rel = relative(ROOT, file).split(sep).join("/");
    if (TEST_PATH_RE.test(rel)) continue;
    // skip the guard's own allowlist commentary
    if (rel === "scripts/check-billing-guard.mjs") continue;
    let source;
    try {
      source = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const rule of RULES) {
      if (rule.pathFilter && !rule.pathFilter(rel)) continue;
      let m;
      while ((m = rule.re.exec(source)) !== null) {
        const line = source.slice(0, m.index).split("\n").length;
        violations.push({ rule: rule.name, file: rel, line, snippet: m[0].slice(0, 80) });
      }
      rule.re.lastIndex = 0;
    }
  }
}

if (violations.length === 0) {
  console.log("billing-guard: ok — no banned patterns found.");
  process.exit(0);
}

console.error(`billing-guard: ${violations.length} violation(s)\n`);
const byRule = new Map();
for (const v of violations) {
  if (!byRule.has(v.rule)) byRule.set(v.rule, []);
  byRule.get(v.rule).push(v);
}
for (const [rule, list] of byRule) {
  const ruleMeta = RULES.find((r) => r.name === rule);
  console.error(`[${rule}] ${ruleMeta?.description ?? ""}`);
  for (const v of list) {
    console.error(`  ${v.file}:${v.line}: ${v.snippet}`);
  }
  console.error("");
}
process.exit(1);
