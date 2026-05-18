#!/usr/bin/env node
// lessonrun:audit — Sprint 07 gate.
//
// Verifies the lesson-runtime contract in docs/lesson-runtime/contract.md:
//
// 1. LessonRunStatus and LessonRunSource unions are parseable and
//    non-empty in apps/web-v2/lib/db/types.ts.
// 2. Every LessonRunSource value has at least one referencing creator
//    path (string source: "X" appears in some BFF route under
//    apps/web-v2/app/api/bff/**).
// 3. apps/web-v2/lib/ai/tutor.ts has generateLessonPlanWithRetry,
//    keeps the fallback safety net contained to that file, and the
//    fallback re-validates its output with .parse() (not .safeParse()).
// 4. BaselineItem from packages/adaptive-baseline declares skillId.
//
// Behavioral assertions live in the affected packages' vitest suites.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

const errors = [];

// --- 1. Parse unions -----------------------------------------------------

const typesPath = join(repoRoot, "apps/web-v2/lib/db/types.ts");
if (!existsSync(typesPath)) {
  errors.push("apps/web-v2/lib/db/types.ts missing.");
} else {
  const src = readFileSync(typesPath, "utf8");
  function parseUnion(name) {
    const m = src.match(new RegExp(`export type ${name}\\s*=\\s*([\\s\\S]*?);`));
    if (!m) return [];
    return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
  }
  const status = parseUnion("LessonRunStatus");
  const source = parseUnion("LessonRunSource");
  const step = parseUnion("LessonStepKind");
  if (status.length === 0) errors.push("LessonRunStatus union not found.");
  if (source.length === 0) errors.push("LessonRunSource union not found.");
  if (step.length === 0) errors.push("LessonStepKind union not found.");
  // 2. Every source has at least one creator reference. Scan both the
  // BFF route handlers and the helper modules (lib/learner/*,
  // lib/validators/lesson*) that route handlers delegate to.
  const scanRoots = [
    join(repoRoot, "apps/web-v2/app/api/bff"),
    join(repoRoot, "apps/web-v2/lib/learner"),
    join(repoRoot, "apps/web-v2/lib/validators"),
  ];
  const allBffSrc = scanRoots
    .flatMap((r) => walk(r))
    .filter((p) => p.endsWith(".ts") || p.endsWith(".tsx"))
    .map((p) => readFileSync(p, "utf8"))
    .join("\n");
  // Allowed creator forms:
  //   source: "today_mission"
  //   source: "today_mission" as LessonRunSource
  //   LessonRunSource = "today_mission"
  for (const s of source) {
    const re = new RegExp(`"${s}"`);
    if (!re.test(allBffSrc)) {
      // Allowed exception: baseline_followup is created internally by
      // learning-svc, not by a BFF route. Check learning-svc src too.
      const internalPath = join(repoRoot, "services/learning-svc/src");
      const internalSrc = existsSync(internalPath)
        ? walk(internalPath)
            .filter((p) => p.endsWith(".ts"))
            .map((p) => readFileSync(p, "utf8"))
            .join("\n")
        : "";
      if (!re.test(internalSrc)) {
        errors.push(
          `LessonRunSource "${s}" has no creator: not referenced in any apps/web-v2 BFF route or learning-svc source. Either wire a creator or remove from the union.`,
        );
      }
    }
  }
}

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

// --- 3. Tutor orchestrator contract --------------------------------------

const tutorPath = join(repoRoot, "apps/web-v2/lib/ai/tutor.ts");
if (!existsSync(tutorPath)) {
  errors.push("apps/web-v2/lib/ai/tutor.ts missing.");
} else {
  const src = readFileSync(tutorPath, "utf8");
  if (!/export async function generateLessonPlanWithRetry/.test(src)) {
    errors.push(
      "lib/ai/tutor.ts: generateLessonPlanWithRetry must remain the single orchestrator entry point.",
    );
  }
  if (!/generateDeterministicLessonPlan\(input\)/.test(src)) {
    errors.push(
      "lib/ai/tutor.ts: deterministic fallback (generateDeterministicLessonPlan) must remain wired as the safety net.",
    );
  }
  if (!/GeneratedLessonPlanSchema\.parse\(fallback\)/.test(src)) {
    errors.push(
      "lib/ai/tutor.ts: deterministic fallback must be re-validated with .parse() — a regression must throw, not silently ship a malformed plan.",
    );
  }
  // No other file may import generateDeterministicLessonPlan.
  const root = join(repoRoot, "apps/web-v2");
  for (const f of walk(root)) {
    if (!f.endsWith(".ts") && !f.endsWith(".tsx")) continue;
    if (f === tutorPath) continue;
    const fsrc = readFileSync(f, "utf8");
    if (
      /generateDeterministicLessonPlan/.test(fsrc) &&
      !/export.*generateDeterministicLessonPlan/.test(fsrc)
    ) {
      // Permit the module that DEFINES the function. Flag any other
      // direct caller.
      if (
        !/from ".\/deterministic-lesson-plan"/.test(fsrc) ||
        /generateDeterministicLessonPlan\s*\(/.test(fsrc)
      ) {
        if (f.endsWith("deterministic-lesson-plan.ts")) continue;
        errors.push(
          `${f.replace(repoRoot + "/", "")}: only generateLessonPlanWithRetry may invoke generateDeterministicLessonPlan; reach the orchestrator instead.`,
        );
      }
    }
  }
}

// --- 4. BaselineItem requires skillId ------------------------------------

const baselinePath = join(repoRoot, "packages/adaptive-baseline/src/index.ts");
if (!existsSync(baselinePath)) {
  errors.push("packages/adaptive-baseline/src/index.ts missing.");
} else {
  const src = readFileSync(baselinePath, "utf8");
  const m = src.match(/export interface BaselineItem\s*\{([\s\S]*?)\}/);
  if (!m) {
    errors.push("BaselineItem interface not found in adaptive-baseline.");
  } else if (!/skillId:\s*string/.test(m[1])) {
    errors.push("BaselineItem.skillId must remain a required string field.");
  }
}

if (errors.length) {
  for (const e of errors) console.error(`error: ${e}`);
  console.error(`\nlessonrun:audit FAILED with ${errors.length} error(s).`);
  process.exit(1);
}

console.log(
  "lessonrun:audit OK — lesson runtime contract intact (unions, creators, tutor orchestrator, deterministic fallback, BaselineItem.skillId).",
);
