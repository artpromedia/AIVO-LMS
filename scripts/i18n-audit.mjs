#!/usr/bin/env node
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, basename } from "node:path";

const APPS = [
  { name: "web", dir: "apps/web/src/i18n/messages", base: "en" },
  { name: "marketing", dir: "apps/marketing/src/i18n/messages", base: "en" },
  { name: "mobile", dir: "apps/mobile/i18n", base: "en" },
];

const BRAND_TOKENS = new Set([
  "AIVO", "IEP", "PIN", "PDF", "API", "URL", "MFA", "JSON", "XML",
  "HTML", "CSS", "JS", "TS", "HTTP", "HTTPS", "UUID", "OK", "OAuth",
  "SAML", "SSO", "FERPA", "COPPA", "GDPR", "AI", "ML", "ID", "URL",
]);

// Per-locale allowlist of values that are legitimately identical to English.
// These are cross-language loanwords (Status, Avatar, Dashboard, Blog, etc.),
// native language self-names (Deutsch, Español, Português, Français), and
// domain terms (Visual, Vestibular, Motor, Tactile) that translate to the
// same word in the target language. They should not count as "untranslated".
const LOANWORDS_BY_LOCALE = {
  ar: new Set([]),
  hi: new Set([]),
  de: new Set([
    "Status", "Name", "Details", "Optional", "Standard", "Standards",
    "Quests", "Avatar", "Avatars", "Power-Ups", "Shop", "Start", "Okay",
    "Dashboard", "Team", "Trend", "Version", "Deutsch", "Blog",
  ]),
  es: new Set([
    "Error", "Total", "General", "Avatar", "Visual", "Vestibular",
    "Español", "Legal", "Blog", "Motor",
  ]),
  fr: new Set([
    "Actions", "Date", "Type", "Description", "Total", "Question",
    "Co-parent", "Badges", "Notifications", "Standard", "Animations",
    "Avatars", "Avatar", "Services", "Documents", "Note", "Tactile",
    "Collaboration", "Messages", "Stable", "stable", "Version",
    "Français", "Solutions", "Blog", "Contact", "Score", "Vision",
    "Placement", "Communication", "Signatures",
    "{count} minutes",
    "Section {number} · ~{minutes} min",
  ]),
  ja: new Set([]),
  ko: new Set([]),
  pt: new Set([
    "Status", "Total", "Power-ups", "Avatar", "Visual", "Vestibular",
    "Português", "Legal", "Blog", "Motor",
  ]),
  zh: new Set([]),
};

// Patterns for technical/example values that should never count as
// "untranslated" regardless of locale: example email addresses, URLs,
// version-tagged product strings, and strings that contain no alphabetic
// content outside ICU placeholders (e.g. "{count, plural, ...}").
// This is intentionally narrow — it must NOT exempt regular short UI
// copy like "Up", "Met", "Yes" from translation checks.
function looksLikeTechnicalPattern(value) {
  if (typeof value !== "string") return false;
  const t = value.trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return true;
  if (/^https?:\/\//i.test(t)) return true;
  if (/\bv?\d+(\.\d+){1,3}\b/.test(t)) return true;
  // Strip ICU placeholders (with nesting) and check for any letters left.
  let stripped = t;
  for (let i = 0; i < 5; i++) {
    const next = stripped.replace(/\{[^{}]*\}/g, "");
    if (next === stripped) break;
    stripped = next;
  }
  if (!/[A-Za-z\u00C0-\u024F]/.test(stripped)) return true;
  return false;
}

function flatten(obj, prefix = "", out = {}) {
  for (const [k, v] of Object.entries(obj ?? {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      flatten(v, key, out);
    } else {
      out[key] = v;
    }
  }
  return out;
}

function looksLikeBrandOrToken(value) {
  if (typeof value !== "string") return true;
  const trimmed = value.trim();
  if (trimmed.length <= 3) return true;
  if (!/[A-Za-z]{3,}/.test(trimmed)) return true;
  if (/^v?\d+(\.\d+)+/.test(trimmed)) return true; // version strings
  // All uppercase tokens / brand acronyms
  const tokens = trimmed.split(/\s+/);
  if (tokens.every(t => BRAND_TOKENS.has(t.replace(/[.,!?:;]+$/, "")))) return true;
  return false;
}

function loadJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function auditApp(app) {
  const baseFile = join(app.dir, `${app.base}.json`);
  if (!existsSync(baseFile)) {
    return { app: app.name, error: `Base locale file not found: ${baseFile}` };
  }
  const baseFlat = flatten(loadJson(baseFile));
  const baseKeys = new Set(Object.keys(baseFlat));

  const localeFiles = readdirSync(app.dir)
    .filter(f => f.endsWith(".json") && basename(f, ".json") !== app.base)
    .sort();

  const report = { app: app.name, baseKeyCount: baseKeys.size, locales: {} };

  for (const f of localeFiles) {
    const locale = basename(f, ".json");
    const flat = flatten(loadJson(join(app.dir, f)));
    const keys = new Set(Object.keys(flat));

    const missing = [...baseKeys].filter(k => !keys.has(k));
    const orphans = [...keys].filter(k => !baseKeys.has(k));
    const untranslated = [];
    const allowedLoanwords = LOANWORDS_BY_LOCALE[locale] ?? new Set();
    for (const k of baseKeys) {
      const bv = baseFlat[k];
      const lv = flat[k];
      if (typeof bv !== "string" || bv !== lv) continue;
      if (looksLikeBrandOrToken(bv)) continue;
      if (looksLikeTechnicalPattern(bv)) continue;
      if (allowedLoanwords.has(bv.trim())) continue;
      untranslated.push(k);
    }

    report.locales[locale] = {
      keyCount: keys.size,
      missing,
      orphans,
      untranslated,
    };
  }

  return report;
}

function formatReport(reports, { verbose }) {
  const lines = [];
  let hardFail = 0;
  let softWarn = 0;

  for (const r of reports) {
    if (r.error) {
      lines.push(`\n[${r.app}]  ERROR: ${r.error}`);
      hardFail++;
      continue;
    }
    lines.push(`\n[${r.app}]  base=${r.baseKeyCount} keys`);
    for (const [locale, info] of Object.entries(r.locales)) {
      const m = info.missing.length;
      const o = info.orphans.length;
      const u = info.untranslated.length;
      const tag = (m > 0 || o > 0) ? "FAIL" : (u > 0 ? "warn" : "ok  ");
      lines.push(
        `  ${tag}  ${locale.padEnd(3)}  keys=${String(info.keyCount).padStart(4)}  ` +
        `missing=${String(m).padStart(3)}  orphans=${String(o).padStart(3)}  untranslated=${String(u).padStart(4)}`
      );
      if (m > 0) hardFail += m;
      if (o > 0) hardFail += o;
      if (u > 0) softWarn += u;

      if (verbose) {
        if (m > 0) {
          lines.push(`        missing keys:`);
          for (const k of info.missing.slice(0, 25)) lines.push(`          - ${k}`);
          if (info.missing.length > 25) lines.push(`          ... and ${info.missing.length - 25} more`);
        }
        if (o > 0) {
          lines.push(`        orphan keys (in ${locale} but not in base):`);
          for (const k of info.orphans.slice(0, 25)) lines.push(`          - ${k}`);
          if (info.orphans.length > 25) lines.push(`          ... and ${info.orphans.length - 25} more`);
        }
        if (u > 0) {
          lines.push(`        untranslated (sample):`);
          for (const k of info.untranslated.slice(0, 10)) lines.push(`          - ${k}`);
          if (info.untranslated.length > 10) lines.push(`          ... and ${info.untranslated.length - 10} more`);
        }
      }
    }
  }

  lines.push("");
  lines.push(`Summary: ${hardFail} hard failures (missing/orphan keys), ${softWarn} untranslated strings (warnings).`);
  return { text: lines.join("\n"), hardFail, softWarn };
}

const args = new Set(process.argv.slice(2));
const verbose = args.has("--verbose") || args.has("-v");
const json = args.has("--json");
const strictUntranslated = args.has("--strict-untranslated");

const reports = APPS.map(auditApp);

const totals = reports.reduce(
  (acc, r) => {
    if (r.error) { acc.hardFail++; return acc; }
    for (const info of Object.values(r.locales)) {
      acc.hardFail += info.missing.length + info.orphans.length;
      acc.softWarn += info.untranslated.length;
    }
    return acc;
  },
  { hardFail: 0, softWarn: 0 },
);

if (json) {
  process.stdout.write(JSON.stringify({ reports, totals }, null, 2) + "\n");
} else {
  const { text } = formatReport(reports, { verbose });
  process.stdout.write(text + "\n");
}

const fail = totals.hardFail > 0 || (strictUntranslated && totals.softWarn > 0);
process.exit(fail ? 1 : 0);
