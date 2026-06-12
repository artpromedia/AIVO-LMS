#!/usr/bin/env node
// agent:eval — remediation Sprint 10 gate.
//
// The in-lesson tutor agent may be enabled per tutor ONLY behind a passing
// REAL-MODEL evaluation:
//
//   1. web-v2's AGENT_ENABLED_TUTORS (apps/web-v2/lib/bff/agent-pilot.ts)
//      lists the tutors allowed to open agent sessions.
//   2. docs/quality/agent-eval-scorecard.json records per-tutor verdicts
//      written by services/ai-svc/tests/agent_quality_eval — which runs the
//      REAL run_turn → litellm path (the all-14 `tutor:behavior` gate proves
//      guard/ladder plumbing with a SCRIPTED model and is deliberately not
//      sufficient here).
//
// This gate fails when any enabled tutor lacks a `status: "passed"` entry,
// when the scorecard's threshold was lowered below the floor, or when the
// scorecard is missing entirely. An empty enabled list with an empty
// scorecard is the legitimate starting state (agent off everywhere).

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];

const MIN_PASS_THRESHOLD = 0.75;

const pilotPath = join(repoRoot, "apps/web-v2/lib/bff/agent-pilot.ts");
const pilotSrc = readFileSync(pilotPath, "utf8");
const enabledMatch = pilotSrc.match(
  /export const AGENT_ENABLED_TUTORS[^=]*=\s*\[([^\]]*)\]/,
);
if (!enabledMatch) {
  errors.push("agent-pilot.ts: AGENT_ENABLED_TUTORS not found — the eval gate has no anchor.");
}
const enabled = enabledMatch
  ? [...enabledMatch[1].matchAll(/"([^"]+)"/g)].map((m) => m[1])
  : [];

const scorecardPath = join(repoRoot, "docs/quality/agent-eval-scorecard.json");
let scorecard = null;
if (!existsSync(scorecardPath)) {
  errors.push("docs/quality/agent-eval-scorecard.json missing — run the ai-svc quality eval.");
} else {
  scorecard = JSON.parse(readFileSync(scorecardPath, "utf8"));
  if (typeof scorecard.passThreshold !== "number" || scorecard.passThreshold < MIN_PASS_THRESHOLD) {
    errors.push(
      `scorecard passThreshold ${scorecard?.passThreshold} is below the floor ${MIN_PASS_THRESHOLD}.`,
    );
  }
}

for (const tutorKey of enabled) {
  const entry = scorecard?.tutors?.[tutorKey];
  if (!entry) {
    errors.push(
      `tutor "${tutorKey}" is in AGENT_ENABLED_TUTORS but has NO scorecard entry — ` +
        `run the real-model eval (services/ai-svc/tests/agent_quality_eval) first.`,
    );
    continue;
  }
  if (entry.status !== "passed") {
    errors.push(
      `tutor "${tutorKey}" is enabled but its real-model eval status is "${entry.status}" ` +
        `(score=${entry.score}). Disable it or fix the model behaviour and re-run the eval.`,
    );
  }
  if (entry.hardFail) {
    errors.push(`tutor "${tutorKey}" recorded an UNACCEPTABLE action in eval — must stay disabled.`);
  }
}

console.log(
  `agent:eval — enabled tutors: ${enabled.length ? enabled.join(", ") : "(none)"} · ` +
    `scorecard entries: ${Object.keys(scorecard?.tutors ?? {}).length}`,
);
if (errors.length) {
  for (const e of errors) console.error(`  error: ${e}`);
  console.error(`\nagent:eval FAILED with ${errors.length} error(s).`);
  process.exit(1);
}
console.log("agent:eval OK — no tutor is enabled without a passing real-model evaluation.");
