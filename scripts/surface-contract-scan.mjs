#!/usr/bin/env node
/**
 * Surface contract scanner.
 *
 * Verifies that production code keeps surface-aware contracts intact:
 *
 *   - baseline generator (services/ai-svc) declares a LearnerSurfaceSpec or
 *     equivalent item-surface contract
 *   - geometry baseline items can request geometry_workspace
 *   - math computation baseline items can request scratchpad
 *   - tutor prompt builder mentions a Surface Tool Protocol
 *   - web SurfaceResponseZone uses SurfaceHost
 *   - mobile learner stage uses a real session loader (no hardcoded QUESTIONS)
 *
 * These checks are intentionally structural — they look for the presence of
 * named symbols and well-known string anchors. Sprints 02–04 fill in the
 * actual implementations.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "..");

/** @type {{ id: string; message: string; hint?: string }[]} */
const failures = [];

function fail(id, message, hint) {
  failures.push({ id, message, hint });
}

function readIfExists(rel) {
  const p = resolve(REPO_ROOT, rel);
  if (!existsSync(p)) return null;
  try {
    return readFileSync(p, "utf8");
  } catch {
    return null;
  }
}

function readAnyMatching(rel, predicate) {
  const p = resolve(REPO_ROOT, rel);
  if (!existsSync(p)) return null;
  let entries;
  try {
    entries = readdirSync(p);
  } catch {
    return null;
  }
  for (const name of entries) {
    const abs = join(p, name);
    let st;
    try {
      st = statSync(abs);
    } catch {
      continue;
    }
    if (!st.isFile()) continue;
    if (!predicate(name)) continue;
    return readFileSync(abs, "utf8");
  }
  return null;
}

// ---------------------------------------------------------------------------
// 1. baseline generator declares LearnerSurfaceSpec (or equivalent)
// ---------------------------------------------------------------------------
const baselineGen =
  readIfExists("services/ai-svc/src/ai_svc/services/baseline_generator.py") ??
  readAnyMatching(
    "services/ai-svc/src/ai_svc/services",
    (n) => n.startsWith("baseline_") && n.endsWith(".py"),
  );
if (!baselineGen) {
  fail("baseline-generator", "Could not locate services/ai-svc baseline generator module");
} else {
  const hasSurfaceContract =
    /LearnerSurfaceSpec\b/.test(baselineGen) ||
    /class\s+BaselineSurfaceContract\b/.test(baselineGen) ||
    /surface\s*:\s*(?:dict|Dict|Optional)/.test(baselineGen) ||
    /baseline_surface_contract/.test(baselineGen);
  if (!hasSurfaceContract) {
    fail(
      "baseline-surface-contract",
      "Baseline generator does not reference a surface contract (LearnerSurfaceSpec or baseline_surface_contract)",
      "Sprint 03 introduces baseline_surface_contract.py",
    );
  }
  if (!/geometry_workspace/.test(baselineGen)) {
    fail(
      "baseline-geometry-surface",
      "Baseline generator cannot request 'geometry_workspace' for geometry items",
      "Sprint 03 wires geometry surfaces into baseline item templates",
    );
  }
  if (!/scratchpad/.test(baselineGen)) {
    fail(
      "baseline-scratchpad-surface",
      "Baseline generator cannot request 'scratchpad' for math computation items",
      "Sprint 03 wires scratchpad surfaces into baseline item templates",
    );
  }
}

// ---------------------------------------------------------------------------
// 2. tutor prompt builder mentions Surface Tool Protocol
// ---------------------------------------------------------------------------
const promptBuilder = readIfExists("services/ai-svc/src/ai_svc/services/prompt_builder.py") ?? "";
if (!promptBuilder) {
  fail("tutor-prompt-builder", "services/ai-svc prompt_builder.py is missing");
} else if (!/Surface Tool Protocol|surfaceCommands/.test(promptBuilder)) {
  fail(
    "tutor-surface-protocol",
    "Tutor prompt builder does not contain a Surface Tool Protocol section",
    "Sprint 04 adds the protocol; for now this is a known warning gate",
  );
}

// ---------------------------------------------------------------------------
// 3. web-v2 SurfaceResponseZone uses SurfaceHost
//
// The legacy apps/web path was retired with the v1 web shell. The check is
// kept here so that whenever a SurfaceResponseZone reappears under
// apps/web-v2 it still has to render via SurfaceHost; until then this
// silently passes.
// ---------------------------------------------------------------------------
const surfaceZone =
  readIfExists("apps/web-v2/components/stage/SurfaceResponseZone.tsx") ??
  readIfExists("apps/web-v2/components/stage/SurfaceResponseZone.ts") ??
  "";
if (surfaceZone && !/SurfaceHost\b/.test(surfaceZone)) {
  fail("surface-response-zone-host", "SurfaceResponseZone does not render via SurfaceHost");
}

// ---------------------------------------------------------------------------
// 4. mobile learner stage uses a real session loader (no hardcoded QUESTIONS)
// ---------------------------------------------------------------------------
const mobileStage = readIfExists("apps/mobile/app/(learner)/stage/[sessionId].tsx") ?? "";
if (!mobileStage) {
  fail("mobile-stage-missing", "apps/mobile/app/(learner)/stage/[sessionId].tsx is missing");
} else {
  const hasHardcodedQuestions = /\b(?:const|let|var)\s+QUESTIONS\s*[:=]\s*\[/.test(mobileStage);
  const hasSessionLoader = /useSession\(|getSession\(|sessionClient\.|fetchStageSession\(/.test(
    mobileStage,
  );
  if (hasHardcodedQuestions) {
    fail(
      "mobile-stage-hardcoded-questions",
      "Mobile learner stage still declares a hardcoded QUESTIONS array",
      "Sprint 02 replaces it with the real session runtime",
    );
  }
  if (!hasSessionLoader) {
    fail(
      "mobile-stage-no-session-loader",
      "Mobile learner stage does not call a session loader (sessionClient.getSession)",
      "Sprint 02 introduces apps/mobile/src/api/sessionClient.ts",
    );
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
if (!failures.length) {
  console.log("surface-contract-scan: OK");
  process.exit(0);
}

console.log(`surface-contract-scan: FAIL (${failures.length})`);
for (const f of failures) {
  console.log(`  ✗ [${f.id}] ${f.message}`);
  if (f.hint) console.log(`      hint: ${f.hint}`);
}
process.exit(1);
