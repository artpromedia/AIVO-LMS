#!/usr/bin/env node
// ai-safety:audit — Sprint 14 gate.
//
// Verifies the AI safety contract in docs/ai-safety/contract.md:
//
// 1. apps/web-v2/lib/env.ts retains the AI_PROVIDER=mock production
//    refusal (Sprint 03 cross-check).
// 2. apps/web-v2/lib/ai/safety.ts exports the canonical pipeline.
// 3. services/responsible-ai-svc/src/services/ contains every
//    evaluator the contract names.
// 4. homework-integrity-evaluator still rejects answer-up-front
//    patterns.
// 5. Public + admin safety BFF routes exist.

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

// --- 1. AI_PROVIDER prod guard ----------------------------------------

const envSrc = read("apps/web-v2/lib/env.ts");
if (envSrc) {
  if (!/aiProviderSchema\s*=\s*isProd/.test(envSrc)) {
    errors.push(
      "apps/web-v2/lib/env.ts: AI_PROVIDER schema must branch on isProd and refuse 'mock' in production.",
    );
  }
  if (!/AI_PROVIDER must be one of/.test(envSrc)) {
    errors.push(
      "apps/web-v2/lib/env.ts: AI_PROVIDER refusal message lost; restore the human-readable refusal.",
    );
  }
}

// --- 2. lib/ai/safety.ts canonical exports ----------------------------

const safetySrc = read("apps/web-v2/lib/ai/safety.ts");
if (safetySrc) {
  for (const fn of [
    "classify",
    "sanitizeHomeworkInput",
    "validateTutorResponse",
    "validateLessonPlan",
    "blockedFallbackFor",
  ]) {
    if (!new RegExp(`export function ${fn}\\b`).test(safetySrc)) {
      errors.push(`lib/ai/safety.ts: missing export ${fn}().`);
    }
  }
  if (!/export const DEFAULT_SAFETY_POLICY\b/.test(safetySrc)) {
    errors.push("lib/ai/safety.ts: missing export DEFAULT_SAFETY_POLICY.");
  }
}

// --- 3. responsible-ai-svc evaluator catalog --------------------------

const REQUIRED_EVALUATORS = [
  "prompt-injection-detector.ts",
  "age-appropriateness-evaluator.ts",
  "homework-integrity-evaluator.ts",
  "profile-adherence-evaluator.ts",
  "surface-requirement-evaluator.ts",
  "escalation-policy.ts",
];
for (const file of REQUIRED_EVALUATORS) {
  const rel = `services/responsible-ai-svc/src/services/${file}`;
  if (!existsSync(join(repoRoot, rel))) {
    errors.push(`missing evaluator: ${rel}`);
  }
}

// --- 4. Homework integrity rule regression check ----------------------

const integritySrc = read(
  "services/responsible-ai-svc/src/services/homework-integrity-evaluator.ts",
);
if (integritySrc) {
  const REQUIRED_PATTERNS = [/the answer is/i, /answer:/i, /\\s\*=/, /x\\s\*=/];
  for (const re of REQUIRED_PATTERNS) {
    if (!re.test(integritySrc)) {
      errors.push(
        `homework-integrity-evaluator.ts: missing answer-up-front pattern matching ${re.source}.`,
      );
    }
  }
  if (!/final_answer_before_attempt/.test(integritySrc)) {
    errors.push(
      "homework-integrity-evaluator.ts: violation code final_answer_before_attempt missing.",
    );
  }
}

// --- 5. BFF safety routes --------------------------------------------

const REQUIRED_BFF = [
  "apps/web-v2/app/api/bff/safety/classify/route.ts",
  "apps/web-v2/app/api/bff/safety/validate-homework-input/route.ts",
  "apps/web-v2/app/api/bff/safety/validate-lesson/route.ts",
  "apps/web-v2/app/api/bff/admin/safety/events/route.ts",
  "apps/web-v2/app/api/bff/admin/safety/review-cases/route.ts",
];
for (const rel of REQUIRED_BFF) {
  if (!existsSync(join(repoRoot, rel))) {
    errors.push(`missing safety BFF: ${rel}`);
  }
}

if (errors.length) {
  for (const e of errors) console.error(`error: ${e}`);
  console.error(`\nai-safety:audit FAILED with ${errors.length} error(s).`);
  process.exit(1);
}

console.log(
  "ai-safety:audit OK — provider guard, safety pipeline exports, evaluator catalog, homework integrity patterns, public + admin BFF routes verified.",
);
