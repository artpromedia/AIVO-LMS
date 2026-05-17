#!/usr/bin/env node
/**
 * No-demo-in-production scanner.
 *
 * Walks a fixed allowlist of production source roots and fails when files
 * contain forbidden production tokens (hardcoded demo question arrays, MOCK
 * fallbacks, "coming soon" placeholders used as functional code paths, etc.).
 *
 * Strings inside tests, docs, fixtures, and explicit *.dev.* / *.demo.*
 * files are skipped. Comment-only mentions inside production source are also
 * skipped — the scanner extracts and checks non-comment code lines.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep, extname } from "node:path";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "..");

const ROOTS = [
  "apps/mobile",
  "apps/web",
  "services/ai-svc",
  "services/learning-svc",
  "services/tutor-svc",
  "services/assessment-svc",
];

const SKIP_DIR_NAMES = new Set([
  "node_modules",
  ".next",
  ".turbo",
  "dist",
  "build",
  "coverage",
  "__snapshots__",
  ".expo",
  ".venv",
  "venv",
  "__pycache__",
]);

const SKIP_PATH_FRAGMENTS = [
  `${sep}tests${sep}`,
  `${sep}test${sep}`,
  `${sep}__tests__${sep}`,
  `${sep}e2e${sep}`,
  `${sep}fixtures${sep}`,
  `${sep}docs${sep}`,
  `${sep}stories${sep}`,
  `${sep}storybook${sep}`,
  `${sep}mocks${sep}`,
  `${sep}__mocks__${sep}`,
];

const SKIP_FILE_PATTERNS = [
  /\.test\.[tj]sx?$/,
  /\.spec\.[tj]sx?$/,
  /\.stories\.[tj]sx?$/,
  /\.dev\.[tj]sx?$/,
  /\.demo\.[tj]sx?$/,
  /\.fixture\.[tj]sx?$/,
  /\.mock\.[tj]sx?$/,
  /\.md$/i,
  /\.mdx$/i,
  /\.json$/i,
  /\.snap$/i,
];

const SCANNED_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".py",
]);

/**
 * Rules: each rule has an id, severity, regex, and an allowlist test that
 * permits the match when the line contains an allowed marker (e.g. a dev
 * guard).
 */
const RULES = [
  {
    id: "hardcoded-stage-questions",
    description: "Hardcoded demo/static QUESTIONS array used by production learner stage",
    pattern: /\b(?:const|let|var)\s+QUESTIONS\s*[:=]\s*\[/,
    allow: (line) => /__DEV__|process\.env\.AIVO_MOBILE_DEMO_STAGE|@allow-demo/.test(line),
  },
  {
    id: "generate-demo-beats",
    description: "generateDemoBeats() used outside an explicit dev/demo flag",
    pattern: /generateDemoBeats\s*\(/,
    allow: (line) =>
      /__DEV__|AIVO_MOBILE_DEMO_STAGE|isDev|isDemo|@allow-demo/.test(line),
  },
  {
    id: "mock-question-fallback",
    description: "MOCK question fallback in production path",
    pattern: /\bMOCK_QUESTIONS?\b|\bmockQuestions?\b/,
    allow: (line) => /import\s+type|@allow-demo|__DEV__/.test(line),
  },
  {
    id: "demo-lesson-fallback",
    description: "Demo lesson fallback used in production",
    pattern: /\b(?:demoLesson|fallbackDemoLesson|DEMO_LESSON)\b/,
    allow: (line) => /__DEV__|@allow-demo/.test(line),
  },
  {
    id: "static-stage-questions",
    description: "Static stage questions assigned to a learner-facing prop",
    pattern: /questions\s*=\s*\[\s*\{\s*(?:id|prompt|question)\s*:/,
    allow: (line) => /test|__tests__|fixture|@allow-demo|__DEV__/i.test(line),
  },
  {
    id: "todo-production-blocker",
    description: "TODO production blocker left in code",
    pattern: /TODO[: ]*production[ -]?blocker/i,
    allow: () => false,
  },
  {
    id: "throw-not-implemented",
    description: 'throw new Error("not implemented") in production path',
    pattern: /throw\s+new\s+Error\s*\(\s*["'`]not\s*implemented["'`]\s*\)/i,
    allow: (line) => /@allow-stub|__DEV__/.test(line),
  },
  {
    id: "coming-soon-functional",
    description: '"coming soon" used as a functional production path',
    pattern: /["'`]coming\s+soon["'`]/i,
    // string allowed as UI copy if not a return value of a route/handler
    allow: (line) => !/return|router\.push|navigate|throw|JSON\.stringify/.test(line),
  },
];

/** @type {{ file: string; line: number; rule: string; text: string }[]} */
const findings = [];

function shouldSkipDir(name) {
  return name.startsWith(".") && name !== ".github" ? true : SKIP_DIR_NAMES.has(name);
}

function shouldSkipFile(rel, abs) {
  if (SKIP_PATH_FRAGMENTS.some((frag) => rel.includes(frag))) return true;
  if (SKIP_FILE_PATTERNS.some((re) => re.test(abs))) return true;
  const ext = extname(abs);
  if (!SCANNED_EXTENSIONS.has(ext)) return true;
  return false;
}

function walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    const abs = join(dir, entry);
    let st;
    try {
      st = statSync(abs);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      if (shouldSkipDir(entry)) continue;
      walk(abs);
    } else if (st.isFile()) {
      const rel = relative(REPO_ROOT, abs);
      if (shouldSkipFile(rel, abs)) continue;
      scanFile(abs, rel);
    }
  }
}

function stripCommentLine(line, ext) {
  // crude but adequate: ignore lines that are pure // or # comments
  const trimmed = line.trim();
  if (!trimmed) return "";
  if (ext === ".py") {
    if (trimmed.startsWith("#")) return "";
  } else {
    if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*"))
      return "";
  }
  return line;
}

function scanFile(abs, rel) {
  let content;
  try {
    content = readFileSync(abs, "utf8");
  } catch {
    return;
  }
  const ext = extname(abs);
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    const code = stripCommentLine(raw, ext);
    if (!code) continue;
    for (const rule of RULES) {
      if (rule.pattern.test(code) && !rule.allow(code)) {
        findings.push({
          file: rel,
          line: i + 1,
          rule: rule.id,
          text: code.trim().slice(0, 200),
        });
      }
    }
  }
}

for (const root of ROOTS) {
  const abs = resolve(REPO_ROOT, root);
  walk(abs);
}

if (!findings.length) {
  console.log("no-demo-prod-scan: OK (0 findings).");
  process.exit(0);
}

console.log(`no-demo-prod-scan: FAIL (${findings.length} finding(s))`);
const byRule = new Map();
for (const f of findings) {
  if (!byRule.has(f.rule)) byRule.set(f.rule, []);
  byRule.get(f.rule).push(f);
}
for (const [ruleId, items] of byRule) {
  const rule = RULES.find((r) => r.id === ruleId);
  console.log(`\n  rule: ${ruleId} — ${rule?.description ?? ""}`);
  for (const f of items.slice(0, 25)) {
    console.log(`    ${f.file}:${f.line}  ${f.text}`);
  }
  if (items.length > 25) console.log(`    … and ${items.length - 25} more`);
}
process.exit(1);
