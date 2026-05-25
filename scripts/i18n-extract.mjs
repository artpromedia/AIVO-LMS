#!/usr/bin/env node
/**
 * i18n-extract — Sprint 4 backlog visibility.
 *
 * Walks `apps/web-v2/app/learner/**` and reports JSX text nodes,
 * `aria-label`, `placeholder`, and `title` attributes that contain a
 * literal English string and aren't wrapped in a `t(...)` / `tX(...)`
 * call. The intent is to drive the remaining extraction work to zero —
 * each run lists the next batch of strings to migrate into the i18n
 * catalog and replace at the call site.
 *
 * This is a heuristic, not a parser. It accepts false positives on
 * highly dynamic JSX; treat the output as a backlog seed rather than a
 * gate. Run with `--max=10` to cap the noise.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const learnerRoot = join(repoRoot, "apps/web-v2/app/learner");

const args = new Map(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--(\w+)(?:=(.+))?$/);
    return m ? [m[1], m[2] ?? "true"] : [a, "true"];
  }),
);
const MAX = Number(args.get("max") ?? 50);

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (st.isFile() && /\.(tsx|jsx)$/.test(name)) out.push(full);
  }
  return out;
}

// Each pattern captures a literal English candidate string in
// (group 1). Heuristic guardrails: must contain at least one ASCII
// letter, not be ALL-UPPERCASE (likely a constant), not look like a
// className token, and not be inside a translation call.
const PATTERNS = [
  // aria-label="..."
  { kind: "aria-label", re: /aria-label\s*=\s*"([^"]{3,})"/g },
  // placeholder="..."
  { kind: "placeholder", re: /placeholder\s*=\s*"([^"]{3,})"/g },
  // title="..." (HTML title attribute on JSX elements)
  { kind: "title-attr", re: /\stitle\s*=\s*"([^"]{3,})"/g },
];

// JSX text nodes: `>Some Text<` between tags. Captures group 1.
const JSX_TEXT = />\s*([A-Z][A-Za-z][^<>{}\n]{4,})\s*</g;

const SKIP_VALUES = new Set([
  "true", "false", "null", "undefined",
]);

function looksTranslated(src, index) {
  // Does the match site sit inside a t("…") / getTranslations call?
  const window = src.slice(Math.max(0, index - 60), index);
  return /t[A-Z]?\(\s*["'`]/.test(window) || /\{t\s*\(/.test(window);
}

function isCodey(s) {
  if (SKIP_VALUES.has(s)) return true;
  if (!/[a-zA-Z]/.test(s)) return true;
  if (/^[A-Z0-9_\-/.]+$/.test(s)) return true;     // looks like an ENUM/CONST
  if (/^\$\{/.test(s)) return true;                 // template literal
  if (/^(http|https|mailto|tel|\/)/.test(s)) return true;
  if (/^[a-z][a-z0-9-]+(\s[a-z0-9-]+)+$/.test(s) && !/\s[A-Z]/.test(s)) {
    // very-low-signal lowercase-only string; likely a CSS class hint
    return s.split(/\s+/).length > 3;
  }
  return false;
}

const findings = [];

for (const file of walk(learnerRoot)) {
  const src = readFileSync(file, "utf8");
  for (const { kind, re } of PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(src))) {
      const value = m[1].trim();
      if (isCodey(value)) continue;
      if (looksTranslated(src, m.index)) continue;
      findings.push({ file, kind, value });
    }
  }
  JSX_TEXT.lastIndex = 0;
  let m2;
  while ((m2 = JSX_TEXT.exec(src))) {
    const value = m2[1].trim();
    if (isCodey(value)) continue;
    if (looksTranslated(src, m2.index)) continue;
    findings.push({ file, kind: "jsx-text", value });
  }
}

if (findings.length === 0) {
  console.log("i18n-extract OK — no hardcoded English candidates found under apps/web-v2/app/learner/**.");
  process.exit(0);
}

console.log(`i18n-extract: ${findings.length} candidate strings still hardcoded (showing first ${Math.min(MAX, findings.length)}):\n`);
for (const f of findings.slice(0, MAX)) {
  console.log(`  [${f.kind.padEnd(11)}] ${relative(repoRoot, f.file)}:`);
  console.log(`              "${f.value.length > 100 ? f.value.slice(0, 100) + "…" : f.value}"`);
}
if (findings.length > MAX) {
  console.log(`\n…and ${findings.length - MAX} more. Re-run with --max=${findings.length} to see all.`);
}
// Backlog reporter, not a gate. Exit 0 so CI doesn't block on it.
process.exit(0);
