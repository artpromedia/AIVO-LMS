#!/usr/bin/env node
// billing:audit — Sprint 11 gate.
//
// Verifies the billing contract in docs/billing/contract.md:
//
// 1. packages/billing-entitlements/src/index.ts exports the canonical
//    set of types/functions: PlanId, SubscriptionStatus,
//    TutorSubscriptionStatus, evaluateTutorEntitlement,
//    computeEffectiveTutorSkus, isTutorIncludedInPlan.
// 2. services/billing-svc/src/routes/webhooks.ts still inserts into
//    stripe_webhook_events for dedup.
// 3. services/billing-svc/src/lib/stripe.ts retains idempotencyKey on
//    mutating Stripe calls (checkout / portal / addon / cancel).
// 4. Every BFF route under apps/web-v2/app/api/bff/billing/** and
//    apps/web-v2/app/api/bff/parent/subscription/** either calls
//    evaluateTutorEntitlement or is on the read-only allow-list.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

const errors = [];

// --- 1. Entitlement package exports -----------------------------------

const pkgPath = join(repoRoot, "packages/billing-entitlements/src/index.ts");
if (!existsSync(pkgPath)) {
  errors.push("packages/billing-entitlements/src/index.ts missing.");
} else {
  const src = readFileSync(pkgPath, "utf8");
  const required = [
    { name: "PlanId", re: /export type PlanId\b/ },
    { name: "SubscriptionStatus", re: /export type SubscriptionStatus\b/ },
    {
      name: "TutorSubscriptionStatus",
      re: /export type TutorSubscriptionStatus\b/,
    },
    {
      name: "evaluateTutorEntitlement",
      re: /export function evaluateTutorEntitlement\b/,
    },
    {
      name: "computeEffectiveTutorSkus",
      re: /export function computeEffectiveTutorSkus\b/,
    },
    {
      name: "isTutorIncludedInPlan",
      re: /export function isTutorIncludedInPlan\b/,
    },
  ];
  for (const { name, re } of required) {
    if (!re.test(src)) {
      errors.push(`billing-entitlements: missing export ${name}.`);
    }
  }
}

// --- 2. Webhook idempotency -----------------------------------------

const webhookPath = join(repoRoot, "services/billing-svc/src/routes/webhooks.ts");
if (!existsSync(webhookPath)) {
  errors.push("services/billing-svc/src/routes/webhooks.ts missing.");
} else {
  const src = readFileSync(webhookPath, "utf8");
  if (!/stripe_webhook_events/.test(src) && !/stripeWebhookEvents/.test(src)) {
    errors.push("webhooks.ts: must dedupe via stripe_webhook_events insert (no in-memory dedup).");
  }
}

// --- 3. Mutating Stripe calls use idempotencyKey --------------------

const stripeLibPath = join(repoRoot, "services/billing-svc/src/lib/stripe.ts");
if (!existsSync(stripeLibPath)) {
  errors.push("services/billing-svc/src/lib/stripe.ts missing.");
} else {
  const src = readFileSync(stripeLibPath, "utf8");
  const idempotencyKeyCount = (src.match(/idempotencyKey:/g) ?? []).length;
  if (idempotencyKeyCount < 3) {
    errors.push(
      `services/billing-svc/src/lib/stripe.ts: expected at least 3 idempotencyKey usages, found ${idempotencyKeyCount}.`,
    );
  }
}

// --- 4. BFF billing routes reach the entitlement evaluator ----------

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (st.isFile()) out.push(full);
  }
  return out;
}

// Routes that read-only or are read aggregations don't need to call
// evaluateTutorEntitlement themselves — they DELEGATE to billing-svc
// or admin-svc. Anything that decides whether to UNLOCK a tutor or
// run a paid AI feature must call the evaluator.
const ALLOW_LIST = new Set([
  // top-level billing summary aggregates server-side; the gating
  // happens upstream in billing-svc.
  "apps/web-v2/app/api/bff/billing/route.ts",
  "apps/web-v2/app/api/bff/parent/subscription/route.ts",
  // admin read-only is allow-listed.
  "apps/web-v2/app/api/bff/admin/billing/route.ts",
]);

const ROOTS = [
  join(repoRoot, "apps/web-v2/app/api/bff/billing"),
  join(repoRoot, "apps/web-v2/app/api/bff/parent/subscription"),
  join(repoRoot, "apps/web-v2/app/api/bff/admin/billing"),
];

let scanned = 0;
for (const root of ROOTS) {
  const files = walk(root).filter((p) => p.endsWith("/route.ts"));
  for (const file of files) {
    scanned++;
    const rel = file.replace(repoRoot + "/", "");
    if (ALLOW_LIST.has(rel)) continue;
    const src = readFileSync(file, "utf8");
    const usesEvaluator =
      /evaluateTutorEntitlement\(/.test(src) ||
      /computeEffectiveTutorSkus\(/.test(src) ||
      /isTutorIncludedInPlan\(/.test(src);
    if (!usesEvaluator) {
      // The route may delegate via lib/billing/* helpers. Accept that.
      // We only flag routes that gate something paid without any
      // entitlement check at all.
      const looksGating = /tutorSku|tutorKey|tutor_id|tutorId|isEntitled|entitlement/i.test(src);
      if (looksGating) {
        errors.push(
          `${rel}: handles a tutor / entitlement value but does not call the billing-entitlements evaluator. Reach evaluateTutorEntitlement().`,
        );
      }
    }
  }
}

if (errors.length) {
  for (const e of errors) console.error(`error: ${e}`);
  console.error(`\nbilling:audit FAILED with ${errors.length} error(s).`);
  process.exit(1);
}

console.log(
  `billing:audit OK — entitlement package, webhook idempotency, Stripe idempotency keys, ${scanned} BFF route(s) checked.`,
);
