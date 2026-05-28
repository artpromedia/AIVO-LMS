#!/usr/bin/env node
/**
 * API-boundary lint — enforces ADR 0008.
 *
 * Rule: code under apps/* / packages/api-client/* must not import
 * directly from services/*, and must not `fetch()` an absolute URL
 * inside an upstream service host. All upstream calls go through
 * apps/web-v2/lib/services/* (the typed service clients) or through
 * `callService` from the same module.
 *
 * Exit status 1 on any violation; the script is meant to run in CI
 * alongside the other audit scripts.
 *
 * Usage:
 *   node scripts/check-api-boundary.mjs
 *   node scripts/check-api-boundary.mjs --json   # machine-readable
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const REPO_ROOT = resolve(new URL("..", import.meta.url).pathname);
const SCAN_ROOTS = ["apps", "packages/api-client"];
const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  ".turbo",
  "dist",
  "build",
  ".cache",
  "openapi",
]);

// Allow-list for files that legitimately reference services (the
// service clients themselves, scripts that generate clients, etc.).
const ALLOW_LIST_FILES = [
  /apps\/web-v2\/lib\/services\//,
  /scripts\//,
  /\.test\.(ts|tsx)$/,
  /\.spec\.(ts|tsx)$/,
];

// Service hostnames that, if seen inside a `fetch(...)` literal, are
// flagged. The list mirrors the *_SVC_URL env defaults in lib/env.ts.
const SERVICE_HOSTS = [
  "localhost:3001", // identity
  "localhost:3041", // learning
  "localhost:3060", // integration
  "localhost:3071", // assessment / responsible-ai
  "localhost:3072", // data-governance
  "localhost:3081", // brain
  "localhost:3091", // comms
];

/** @type {{file: string, line: number, snippet: string, rule: string}[]} */
const violations = [];

function isAllowed(file) {
  return ALLOW_LIST_FILES.some((re) => re.test(file));
}

function walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    let info;
    try {
      info = statSync(full);
    } catch {
      continue;
    }
    if (info.isDirectory()) {
      walk(full);
      continue;
    }
    if (!/\.(ts|tsx|mjs|cjs|js|jsx)$/.test(name)) continue;
    const rel = relative(REPO_ROOT, full);
    if (isAllowed(rel)) continue;
    let text;
    try {
      text = readFileSync(full, "utf8");
    } catch {
      continue;
    }
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Rule 1: import from services/*
      if (/from\s+["']services\//.test(line) || /from\s+["']@\/services\//.test(line)) {
        violations.push({
          file: rel,
          line: i + 1,
          snippet: line.trim(),
          rule: "no-import-services",
        });
      }
      // Rule 2: fetch("http://...service-host...") inline literal
      const fetchMatch = line.match(/fetch\(\s*["']([^"']+)["']/);
      if (fetchMatch) {
        const url = fetchMatch[1];
        if (SERVICE_HOSTS.some((h) => url.includes(h))) {
          violations.push({
            file: rel,
            line: i + 1,
            snippet: line.trim(),
            rule: "no-direct-service-fetch",
          });
        }
      }
    }
  }
}

for (const root of SCAN_ROOTS) {
  walk(join(REPO_ROOT, root));
}

const wantJson = process.argv.includes("--json");
if (wantJson) {
  process.stdout.write(JSON.stringify({ violations }, null, 2) + "\n");
} else if (violations.length === 0) {
  process.stdout.write("api-boundary: clean — no direct service imports or fetches.\n");
} else {
  process.stderr.write(
    `api-boundary: ${violations.length} violation(s):\n` +
      violations
        .map((v) => `  ${v.file}:${v.line} [${v.rule}]\n    ${v.snippet}`)
        .join("\n") +
      "\n\nSee apps/web-v2/app/api/bff/README.md + docs/adr/0008 for the rule.\n",
  );
}
process.exit(violations.length === 0 ? 0 : 1);
