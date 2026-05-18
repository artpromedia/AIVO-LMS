#!/usr/bin/env node
// Guardrail (#200): scan tracked source files for hard-coded paging webhook
// URLs. The existing key-name guardrail (#124) catches *_WEBHOOK_URL /
// pagerWebhook keys; this catches the case where a contributor pastes a
// literal Slack/PagerDuty/Opsgenie URL or routing key directly into source.
//
// Exits non-zero (failing CI) if any pattern is found in tracked files.
//
// Allowlist: anything inside .env.example, scripts/check-paging-url-leaks.mjs
// itself, .gitleaks.toml, or any file containing "// paging-url-leaks: ignore"
// on the same line.

import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { extname, basename } from "node:path";

const PATTERNS = [
  { name: "slack-webhook", re: /https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9_\-/]+/g },
  { name: "pagerduty-events", re: /https:\/\/events(?:-eu)?\.pagerduty\.com\/v2\/enqueue/g },
  { name: "pagerduty-events-host", re: /https:\/\/events(?:-eu)?\.pagerduty\.com\b/g },
  { name: "opsgenie-api", re: /https:\/\/api(?:\.eu)?\.opsgenie\.com\/v\d+\/alerts\b/g },
  // Routing keys are 32-hex-char tokens. Allow-list common placeholders.
  {
    name: "pagerduty-routing-key",
    re: /\b[a-f0-9]{32}\b/gi,
    requireKeyword: /pagerduty|routing[_-]?key/i,
  },
];

const ALLOWED_FILES = new Set([
  ".env.example",
  ".gitleaks.toml",
  "check-paging-url-leaks.mjs",
  "check-paging-url-leaks.test.mjs",
  "ops-alerts-external-monitor.mjs",
  "ops-alerts-external-monitor.yaml",
]);

const SKIP_EXT = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
  ".ico",
  ".pdf",
  ".lock",
  ".woff",
  ".woff2",
]);
const SKIP_DIRS = ["node_modules", "dist", "build", ".next", ".turbo", ".git"];

function listTrackedFiles() {
  const out = execSync("git ls-files", { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return out
    .split("\n")
    .filter(Boolean)
    .filter((p) => !SKIP_DIRS.some((d) => p.startsWith(`${d}/`) || p.includes(`/${d}/`)))
    .filter((p) => !SKIP_EXT.has(extname(p)));
}

function scanFile(path) {
  if (!existsSync(path)) return [];
  if (ALLOWED_FILES.has(basename(path))) return [];
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return []; // binary or unreadable
  }
  const findings = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes("paging-url-leaks: ignore")) continue;
    for (const { name, re, requireKeyword } of PATTERNS) {
      re.lastIndex = 0;
      const matches = line.match(re);
      if (!matches) continue;
      if (requireKeyword && !requireKeyword.test(line)) continue;
      for (const m of matches) {
        findings.push({ path, line: i + 1, pattern: name, snippet: m });
      }
    }
  }
  return findings;
}

function main() {
  const files = listTrackedFiles();
  const findings = [];
  for (const f of files) findings.push(...scanFile(f));
  if (findings.length === 0) {
    console.log(
      `paging-url-leaks: scanned ${files.length} files, no hard-coded paging URLs found.`,
    );
    return;
  }
  console.error(`paging-url-leaks: ${findings.length} hard-coded paging URL(s) found:`);
  for (const f of findings) {
    console.error(`  ${f.path}:${f.line} [${f.pattern}] ${f.snippet}`);
  }
  console.error(
    "\nDon't paste paging URLs into source. Read them from env (OPS_ALERTS_*_URL / KEY) " +
      "or, for the external monitor, from a Kubernetes secret. " +
      "If a match is intentional (test fixtures, doc), append `// paging-url-leaks: ignore` to the line.",
  );
  process.exit(1);
}

main();
