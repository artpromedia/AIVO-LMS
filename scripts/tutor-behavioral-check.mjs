#!/usr/bin/env node
/**
 * Wave E (S10) — `pnpm tutor:behavior`: the agentic behaviour gate.
 *
 * Runs the tutor-svc behavioural harness (replays scripted sessions
 * through the REAL AgentOrchestrator) and enforces:
 *
 *   1. Every onboarded tutor passes ALL FIVE agentic checks —
 *      observes / decides from a closed set / guarded transitions /
 *      degrades safely / audited;
 *   2. The onboarding RATCHET — tutors listed in
 *      scripts/tutor-behavior-baseline.json may never silently drop out
 *      of the onboarded roster. Widening the roster updates the baseline
 *      in the same commit (the gate tells you to).
 *
 * Wired into green:check (category: tutor), next to tutor:parity —
 * parity proves the CONFIGURATION, this proves the BEHAVIOUR.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const baselinePath = join(root, "scripts", "tutor-behavior-baseline.json");

function fail(msg) {
  console.error(`tutor:behavior FAILED — ${msg}`);
  process.exit(1);
}

let stdout = "";
try {
  stdout = execFileSync(
    "pnpm",
    ["--dir", "services/tutor-svc", "exec", "tsx", "scripts/agent-behavior-harness.ts"],
    { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 180_000 },
  );
} catch (err) {
  // Harness exits non-zero when a check fails; its report (if any) still
  // carries the diagnosis.
  stdout = `${err.stdout ?? ""}`;
  if (!stdout.includes("BEHAVIOR_REPORT_JSON:")) {
    fail(`harness crashed: ${String(err.message).slice(0, 400)}`);
  }
}

const line = stdout.split("\n").find((l) => l.startsWith("BEHAVIOR_REPORT_JSON:"));
if (!line) fail("harness produced no report line");
let report;
try {
  report = JSON.parse(line.slice("BEHAVIOR_REPORT_JSON:".length));
} catch (err) {
  fail(`report line is not valid JSON: ${err.message}`);
}

const failures = [];
for (const r of report.reports) {
  for (const [check, ok] of Object.entries(r.checks)) {
    if (!ok) failures.push(`${r.tutorKey}: ${check}`);
  }
  for (const note of r.notes) failures.push(`  note: ${note}`);
}
if (failures.length > 0) {
  fail(`agentic checks failed:\n  ${failures.join("\n  ")}`);
}

// ── Onboarding ratchet ──────────────────────────────────────────────────
if (!existsSync(baselinePath)) {
  fail(`missing baseline ${baselinePath}`);
}
const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
const onboarded = new Set(report.onboarded);
const missing = baseline.onboarded.filter((t) => !onboarded.has(t));
if (missing.length > 0) {
  fail(
    `onboarding ratchet: ${missing.join(", ")} dropped from the onboarded roster ` +
      `(baseline ${JSON.stringify(baseline.onboarded)}). Re-onboard or justify in the baseline.`,
  );
}
const widened = report.onboarded.filter((t) => !baseline.onboarded.includes(t));
if (widened.length > 0) {
  baseline.onboarded = [...report.onboarded];
  writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`);
  console.log(`tutor:behavior — roster widened (${widened.join(", ")}); baseline updated, commit it.`);
}

const summary = report.reports
  .map((r) => `${r.tutorKey} 5/5 (${r.levels.join(",")}, ${r.turns} turns)`)
  .join("; ");
console.log(`tutor:behavior OK — ${summary}.`);
