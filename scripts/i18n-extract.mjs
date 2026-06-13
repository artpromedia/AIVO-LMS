#!/usr/bin/env node
/**
 * i18n-extract — hardcoded-English visibility & regression gate.
 *
 * Walks `apps/web-v2/app/**` and reports JSX text nodes, `aria-label`,
 * `placeholder`, and `title` attributes that contain a literal English
 * string and aren't wrapped in a `t(...)` / `tX(...)` call. The intent is
 * to make the extraction backlog measurable and to *ratchet* it down —
 * the platform's file-level i18n audit only checks key parity between
 * locale JSON files, so it never noticed that ~250 components ship
 * hardcoded English. This script closes that hole.
 *
 * Modes
 * -----
 *   (default)              Backlog report grouped by route area. Exit 0.
 *   --by-area              Per-area counts only (no string dump).
 *   --json                 Machine-readable findings + per-area counts.
 *   --gate                 Compare against the committed baseline and
 *                          FAIL (exit 1) if any area regressed (gained
 *                          new hardcoded strings). Use in CI.
 *   --update-baseline      Rewrite the baseline file to the current
 *                          counts. Run after you've extracted a slice so
 *                          the new, lower numbers are locked in.
 *   --scope=<area>         Restrict to one route area (e.g. learner).
 *   --max=<n>              Cap the number of strings printed (default 50).
 *
 * This is a heuristic, not a parser. It accepts false positives on highly
 * dynamic JSX. The gate is a *ratchet over a baseline*, so pre-existing
 * false positives are frozen into the baseline and only NEW strings fail
 * a build — which is exactly the regression we want to prevent.
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const appRoot = join(repoRoot, "apps/web-v2/app");
const BASELINE_PATH = join(__dirname, "i18n-extract-baseline.json");

const args = new Map(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--(\w[\w-]*)(?:=(.+))?$/);
    return m ? [m[1], m[2] ?? "true"] : [a, "true"];
  }),
);
const MAX = Number(args.get("max") ?? 50);
const SCOPE = args.get("scope"); // e.g. "learner" — restrict to one area
const MODE_JSON = args.has("json");
const MODE_BY_AREA = args.has("by-area");
const MODE_GATE = args.has("gate");
const MODE_UPDATE_BASELINE = args.has("update-baseline");

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    // Co-located test/spec fixtures are engineer-only, not shipped UI — their
    // literal strings (mock labels, `aria-label="concerns"`, etc.) are not
    // translatable product copy, so they're excluded like the design galleries.
    else if (st.isFile() && /\.(tsx|jsx)$/.test(name) && !/\.(test|spec)\.(tsx|jsx)$/.test(name))
      out.push(full);
  }
  return out;
}

// Each pattern captures a literal English candidate string in (group 1).
const PATTERNS = [
  { kind: "aria-label", re: /aria-label\s*=\s*"([^"]{3,})"/g },
  { kind: "placeholder", re: /placeholder\s*=\s*"([^"]{3,})"/g },
  { kind: "title-attr", re: /\stitle\s*=\s*"([^"]{3,})"/g },
];

// JSX text nodes: `>Some Text<` between tags. Captures group 1.
const JSX_TEXT = />\s*([A-Z][A-Za-z][^<>{}\n]{4,})\s*</g;

const SKIP_VALUES = new Set(["true", "false", "null", "undefined"]);

function looksTranslated(src, index) {
  // Does the match site sit inside a t("…") / getTranslations call?
  const window = src.slice(Math.max(0, index - 60), index);
  return /t[A-Z]?\(\s*["'`]/.test(window) || /\{t\s*\(/.test(window);
}

function isCodey(s) {
  if (SKIP_VALUES.has(s)) return true;
  if (!/[a-zA-Z]/.test(s)) return true;
  if (/^[A-Z0-9_\-/.]+$/.test(s)) return true; // looks like an ENUM/CONST
  if (/\w\(/.test(s)) return true; // a call expression — `from(`, `querySelectorAll(` — is code, not prose
  if (/^\$\{/.test(s)) return true; // template literal
  if (/^(http|https|mailto|tel|\/)/.test(s)) return true;
  // common email/number placeholder examples — symbolic, not prose
  if (/^[\w.+-]+@[\w.-]+$/.test(s)) return true;
  if (/^[\d\s().+-]+$/.test(s)) return true;
  if (/^[a-z][a-z0-9-]+(\s[a-z0-9-]+)+$/.test(s) && !/\s[A-Z]/.test(s)) {
    return s.split(/\s+/).length > 3;
  }
  return false;
}

// Top-level route area = first path segment under app/.
function areaOf(file) {
  const rel = relative(appRoot, file);
  const seg = rel.split(/[/\\]/)[0];
  return seg.endsWith(".tsx") || seg.endsWith(".jsx") ? "(root)" : seg;
}

// Internal developer tooling — not shipped product UI, so intentionally
// out of the translation scope. The component gallery (design-system), the
// surface-preview harness, and the design-preview replica (dev-only via
// middleware DEV_ONLY_PREFIXES) exist for engineers, never end users.
const IGNORED_AREAS = new Set(["design-system", "surface-preview", "design-preview"]);

const findings = [];
for (const file of walk(appRoot)) {
  const area = areaOf(file);
  if (SCOPE && area !== SCOPE) continue;
  if (IGNORED_AREAS.has(area) && SCOPE !== area) continue;
  const src = readFileSync(file, "utf8");
  for (const { kind, re } of PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(src))) {
      const value = m[1].trim();
      if (isCodey(value)) continue;
      if (looksTranslated(src, m.index)) continue;
      findings.push({ file, area, kind, value });
    }
  }
  JSX_TEXT.lastIndex = 0;
  let m2;
  while ((m2 = JSX_TEXT.exec(src))) {
    // A `>` preceded by `=` is the arrow of `=> Promise<T>` / `=> JSX`, not a
    // tag close, so the captured token is a TS return type, not JSX text.
    if (src[m2.index] === ">" && src[m2.index - 1] === "=") continue;
    const value = m2[1].trim();
    if (isCodey(value)) continue;
    if (looksTranslated(src, m2.index)) continue;
    findings.push({ file, area, kind: "jsx-text", value });
  }
}

// Per-area counts.
const counts = {};
for (const f of findings) counts[f.area] = (counts[f.area] ?? 0) + 1;
const sortedAreas = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);

// ---- --update-baseline -------------------------------------------------
if (MODE_UPDATE_BASELINE) {
  const baseline = { total: findings.length, areas: counts };
  writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + "\n");
  console.log(
    `i18n-extract: baseline updated → ${findings.length} hardcoded strings across ${sortedAreas.length} areas.`,
  );
  process.exit(0);
}

// ---- --json ------------------------------------------------------------
if (MODE_JSON) {
  console.log(
    JSON.stringify(
      {
        total: findings.length,
        areas: counts,
        findings: findings.map((f) => ({
          file: relative(repoRoot, f.file),
          area: f.area,
          kind: f.kind,
          value: f.value,
        })),
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

// ---- --gate (CI ratchet) ----------------------------------------------
if (MODE_GATE) {
  if (!existsSync(BASELINE_PATH)) {
    console.error(
      "i18n-extract --gate: no baseline found. Run `node scripts/i18n-extract.mjs --update-baseline` first.",
    );
    process.exit(2);
  }
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
  const regressions = [];
  for (const area of sortedAreas) {
    const allowed = baseline.areas?.[area] ?? 0;
    if (counts[area] > allowed) {
      regressions.push({ area, was: allowed, now: counts[area] });
    }
  }
  if (regressions.length === 0) {
    console.log(
      `i18n-extract --gate OK — ${findings.length} hardcoded strings (baseline ${baseline.total}). No area regressed.`,
    );
    process.exit(0);
  }
  console.error("i18n-extract --gate FAILED — new hardcoded English strings:\n");
  for (const r of regressions) {
    console.error(`  [${r.area}] ${r.was} → ${r.now} (+${r.now - r.was})`);
    for (const f of findings.filter((x) => x.area === r.area).slice(0, 10)) {
      console.error(`      ${f.kind.padEnd(11)} "${f.value.slice(0, 80)}"`);
    }
  }
  console.error(
    "\nWrap new user-facing strings in t(...) / getTranslations, or — if a slice\n" +
      "was intentionally internationalized — refresh the baseline with\n" +
      "`node scripts/i18n-extract.mjs --update-baseline`.",
  );
  process.exit(1);
}

// ---- default / --by-area: human backlog report -------------------------
if (findings.length === 0) {
  console.log(
    `i18n-extract OK — no hardcoded English candidates found under apps/web-v2/app/${SCOPE ? SCOPE : ""}.`,
  );
  process.exit(0);
}

console.log(
  `i18n-extract: ${findings.length} hardcoded English candidates across ${sortedAreas.length} route areas.\n`,
);
for (const area of sortedAreas) {
  console.log(`  ${String(counts[area]).padStart(4)}  ${area}`);
}

if (!MODE_BY_AREA) {
  console.log(`\nFirst ${Math.min(MAX, findings.length)} strings:\n`);
  for (const f of findings.slice(0, MAX)) {
    console.log(`  [${f.kind.padEnd(11)}] ${relative(repoRoot, f.file)}:`);
    console.log(`              "${f.value.length > 100 ? f.value.slice(0, 100) + "…" : f.value}"`);
  }
  if (findings.length > MAX) {
    console.log(
      `\n…and ${findings.length - MAX} more. Re-run with --max=${findings.length} to see all.`,
    );
  }
}

// Backlog reporter, not a gate (unless --gate). Exit 0.
process.exit(0);
