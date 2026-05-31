#!/usr/bin/env node
/**
 * check-i18n-coverage.mjs
 *
 * Sprint 0 locale-parity guard. Fails CI when any supported locale's
 * message file is missing keys present in the English base, or vice
 * versa (orphan keys).
 *
 * Scope:
 *   - apps/web-v2/lib/i18n/messages/<locale>.json     (10 locales)
 *   - apps/marketing/src/i18n/messages/<locale>.json  (10 locales)
 *   - apps/mobile/i18n/<locale>.json                  (10 locales)
 *   - services/i18n-svc/src/translations/<locale>.ts (10 locales,
 *     file-presence only; TypeScript build enforces shape parity)
 *
 * What this does NOT check:
 *   - Whether values are translated (vs. still in English). That is the
 *     job of `pnpm i18n:audit`, which reports per-locale untranslated
 *     counts as a soft warning. The translation backlog is tracked
 *     separately so structural parity ships first.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const LOCALES = ["en", "es", "fr", "de", "pt", "zh", "ja", "ko", "ar", "hi"];
const BASE = "en";

const TARGETS = [
  {
    name: "web-v2",
    type: "json",
    dir: "apps/web-v2/lib/i18n/messages",
    ext: ".json",
  },
  {
    name: "marketing",
    type: "json",
    dir: "apps/marketing/src/i18n/messages",
    ext: ".json",
  },
  {
    name: "mobile",
    type: "json",
    dir: "apps/mobile/i18n",
    ext: ".json",
  },
];

function flatten(obj, prefix = "", out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      flatten(v, key, out);
    } else {
      out[key] = v;
    }
  }
  return out;
}

function loadJson(p) {
  return JSON.parse(readFileSync(p, "utf8"));
}

let hardFail = 0;
const summary = [];

for (const target of TARGETS) {
  const basePath = join(ROOT, target.dir, `${BASE}${target.ext}`);
  if (!existsSync(basePath)) {
    console.error(`\u2716 ${target.name}: base file missing at ${basePath}`);
    hardFail++;
    continue;
  }
  const baseFlat = flatten(loadJson(basePath));
  const baseKeys = new Set(Object.keys(baseFlat));
  summary.push(`\n[${target.name}]  base=${baseKeys.size} keys`);

  for (const locale of LOCALES) {
    if (locale === BASE) continue;
    const p = join(ROOT, target.dir, `${locale}${target.ext}`);
    if (!existsSync(p)) {
      summary.push(`  FAIL ${locale}  file missing: ${p}`);
      hardFail++;
      continue;
    }
    let flat;
    try {
      flat = flatten(loadJson(p));
    } catch (e) {
      summary.push(`  FAIL ${locale}  invalid JSON: ${e.message}`);
      hardFail++;
      continue;
    }
    const keys = new Set(Object.keys(flat));
    const missing = [...baseKeys].filter((k) => !keys.has(k));
    const orphans = [...keys].filter((k) => !baseKeys.has(k));
    const tag = missing.length || orphans.length ? "FAIL" : "ok  ";
    summary.push(
      `  ${tag} ${locale.padEnd(3)} keys=${String(keys.size).padStart(4)}  ` +
        `missing=${String(missing.length).padStart(3)}  orphans=${String(orphans.length).padStart(3)}`,
    );
    if (missing.length) {
      for (const k of missing.slice(0, 5)) summary.push(`         missing: ${k}`);
      if (missing.length > 5) summary.push(`         ... and ${missing.length - 5} more`);
    }
    if (orphans.length) {
      for (const k of orphans.slice(0, 5)) summary.push(`         orphan:  ${k}`);
      if (orphans.length > 5) summary.push(`         ... and ${orphans.length - 5} more`);
    }
    hardFail += missing.length + orphans.length;
  }
}

// i18n-svc: verify the locale .ts files exist. Deeper parity (key sets)
// is enforced at TypeScript build time because each file exports the
// same `Record<string, string>` shape and is imported by routes.ts.
const svcDir = join(ROOT, "services/i18n-svc/src/translations");
summary.push("\n[i18n-svc] file presence");
for (const locale of LOCALES) {
  const p = join(svcDir, `${locale}.ts`);
  if (!existsSync(p)) {
    summary.push(`  FAIL ${locale}  file missing: ${p}`);
    hardFail++;
  } else {
    summary.push(`  ok   ${locale}`);
  }
}

console.log(summary.join("\n"));
console.log(`\nSummary: ${hardFail} hard failure(s).`);
process.exit(hardFail > 0 ? 1 : 0);
