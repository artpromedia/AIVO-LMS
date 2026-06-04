#!/usr/bin/env node
/**
 * i18n-untranslated-report.mjs
 *
 * Localization Engineering report: distinguish "key coverage" (every locale
 * has the same flat key set) from "real translation" (the value is not a
 * byte-identical copy of the English source). The existing scripts/i18n-audit.mjs
 * already enforces parity; this script makes the *content* gap visible so it
 * can be ratcheted down rather than papered over.
 *
 * For each non-English catalog across web-v2, marketing and mobile we flag
 * keys whose value equals the English source after an allowlist of legitimate
 * exceptions (brand acronyms, URLs, ICU-only strings, loanwords, etc.).
 *
 * Modes:
 *   default                          per-locale + grand totals (human text)
 *   --json                           machine-readable report
 *   --namespace=billing,lti_admin    restrict counting to those top-level keys
 *   --threshold=path/to/baseline.json ratchet mode: fail (exit 2) if any
 *                                    (app, locale) exceeds its baseline count
 *   --update-threshold               rewrite the baseline file with current
 *                                    counts (only use when intentionally
 *                                    translating, never to silently regrow)
 *   --max-targeted=0                 fail (exit 3) if any targeted-namespace
 *                                    count is above N (default 0)
 *   --verbose                        print sample keys per locale
 *
 * Exit codes:
 *   0  ok / under threshold
 *   2  regression vs baseline
 *   3  targeted-namespace count above --max-targeted
 *   4  invalid invocation
 */

import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join, basename, resolve } from "node:path";

const APPS = [
  { name: "web", dir: "apps/web-v2/lib/i18n/messages", base: "en" },
  { name: "marketing", dir: "apps/marketing/src/i18n/messages", base: "en" },
  { name: "mobile", dir: "apps/mobile/i18n", base: "en" },
];

// Brand / protocol tokens that legitimately never translate.
const BRAND_TOKENS = new Set([
  "AIVO",
  "IEP",
  "PIN",
  "PDF",
  "API",
  "URL",
  "MFA",
  "JSON",
  "XML",
  "HTML",
  "CSS",
  "JS",
  "TS",
  "HTTP",
  "HTTPS",
  "UUID",
  "OK",
  "OAuth",
  "SAML",
  "SSO",
  "FERPA",
  "COPPA",
  "GDPR",
  "AI",
  "ML",
  "ID",
  "LTI",
  "AGS",
  "JWKS",
  "JWT",
  "SIS",
  "LMS",
  "CSV",
  "SVG",
  "PNG",
  "JPG",
  "GIF",
]);

// Per-locale allowlist of values that are legitimately identical to English.
// Mirrors scripts/i18n-audit.mjs LOANWORDS_BY_LOCALE.
const LOANWORDS_BY_LOCALE = {
  ar: new Set([]),
  hi: new Set([]),
  de: new Set([
    "Status",
    "Name",
    "Details",
    "Optional",
    "Standard",
    "Standards",
    "Quests",
    "Avatar",
    "Avatars",
    "Power-Ups",
    "Shop",
    "Start",
    "Okay",
    "Dashboard",
    "Team",
    "Trend",
    "Version",
    "Deutsch",
    "Blog",
    // genuine loanwords used as-is in German UI
    "Offline",
  ]),
  es: new Set([
    "Error",
    "Total",
    "General",
    "Avatar",
    "Visual",
    "Vestibular",
    "Español",
    "Legal",
    "Blog",
    "Motor",
  ]),
  fr: new Set([
    "Actions",
    "Date",
    "Type",
    "Description",
    "Total",
    "Question",
    "Co-parent",
    "Badges",
    "Notifications",
    "Standard",
    "Animations",
    "Avatars",
    "Avatar",
    "Services",
    "Documents",
    "Note",
    "Tactile",
    "Collaboration",
    "Messages",
    "Stable",
    "stable",
    "Version",
    "Français",
    "Solutions",
    "Blog",
    "Contact",
    "Score",
    "Vision",
    "Placement",
    "Communication",
    "Signatures",
    // genuine cognates that are spelled identically in French
    "Microphone",
    "client",
  ]),
  ja: new Set([]),
  ko: new Set([]),
  pt: new Set([
    "Status",
    "Total",
    "Power-ups",
    "Avatar",
    "Visual",
    "Vestibular",
    "Português",
    "Legal",
    "Blog",
    "Motor",
    // loanword used as-is in Portuguese UI
    "Offline",
  ]),
  zh: new Set([]),
};

function looksLikeTechnicalPattern(value) {
  if (typeof value !== "string") return false;
  const t = value.trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return true; // email
  if (/^https?:\/\//i.test(t)) return true; // URL
  if (/\bv?\d+(\.\d+){1,3}\b/.test(t)) return true; // version
  // Strip ICU placeholders (with nesting); if nothing alphabetic remains, it's
  // a placeholder-only string and not translatable.
  let stripped = t;
  for (let i = 0; i < 5; i++) {
    const next = stripped.replace(/\{[^{}]*\}/g, "");
    if (next === stripped) break;
    stripped = next;
  }
  if (!/[A-Za-z\u00C0-\u024F]/.test(stripped)) return true;
  return false;
}

// Multi-token product names and universal sample placeholders that are
// intentionally not localized. These are added here (rather than to the
// per-locale loanword sets) because they apply identically across every
// locale and represent product identity / spec-defined formats.
const UNIVERSAL_BRAND_PHRASES = new Set([
  "AIVO Learning",
  "© AIVO Learning",
  // sample LTI deployment placeholder used in the admin UI
  "Canvas — District",
  "1:abcdef…",
]);

function looksLikeBrandOrToken(value) {
  if (typeof value !== "string") return true;
  const trimmed = value.trim();
  if (trimmed.length <= 3) return true;
  if (!/[A-Za-z]{3,}/.test(trimmed)) return true;
  if (/^v?\d+(\.\d+)+/.test(trimmed)) return true;
  if (UNIVERSAL_BRAND_PHRASES.has(trimmed)) return true;
  const tokens = trimmed.split(/\s+/);
  if (tokens.every((t) => BRAND_TOKENS.has(t.replace(/[.,!?:;]+$/, "")))) return true;
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

function loadJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function topNamespace(flatKey) {
  const dot = flatKey.indexOf(".");
  return dot === -1 ? flatKey : flatKey.slice(0, dot);
}

function auditApp(app, { namespaceFilter }) {
  const baseFile = join(app.dir, `${app.base}.json`);
  if (!existsSync(baseFile)) {
    return { app: app.name, error: `Base locale file not found: ${baseFile}` };
  }
  const baseFlat = flatten(loadJson(baseFile));
  const baseKeys = Object.keys(baseFlat);

  const localeFiles = readdirSync(app.dir)
    .filter((f) => f.endsWith(".json") && basename(f, ".json") !== app.base)
    .sort();

  const locales = {};
  for (const f of localeFiles) {
    const locale = basename(f, ".json");
    const flat = flatten(loadJson(join(app.dir, f)));
    const allowedLoanwords = LOANWORDS_BY_LOCALE[locale] ?? new Set();

    const untranslated = [];
    const targetedUntranslated = [];
    for (const k of baseKeys) {
      const bv = baseFlat[k];
      const lv = flat[k];
      if (typeof bv !== "string" || bv !== lv) continue;
      if (looksLikeBrandOrToken(bv)) continue;
      if (looksLikeTechnicalPattern(bv)) continue;
      if (allowedLoanwords.has(bv.trim())) continue;
      untranslated.push(k);
      if (namespaceFilter && namespaceFilter.has(topNamespace(k))) {
        targetedUntranslated.push(k);
      }
    }

    locales[locale] = {
      total: untranslated.length,
      targeted: targetedUntranslated.length,
      keys: untranslated,
      targetedKeys: targetedUntranslated,
    };
  }

  return { app: app.name, baseKeyCount: baseKeys.length, locales };
}

function parseArgs(argv) {
  const args = {
    json: false,
    verbose: false,
    namespaces: null,
    threshold: null,
    updateThreshold: false,
    maxTargeted: null,
  };
  for (const a of argv) {
    if (a === "--json") args.json = true;
    else if (a === "--verbose" || a === "-v") args.verbose = true;
    else if (a === "--update-threshold") args.updateThreshold = true;
    else if (a.startsWith("--namespace=")) {
      args.namespaces = new Set(
        a
          .slice("--namespace=".length)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      );
    } else if (a.startsWith("--threshold=")) {
      args.threshold = a.slice("--threshold=".length);
    } else if (a.startsWith("--max-targeted=")) {
      const n = Number(a.slice("--max-targeted=".length));
      if (!Number.isFinite(n) || n < 0) {
        console.error(`invalid --max-targeted value: ${a}`);
        process.exit(4);
      }
      args.maxTargeted = n;
    } else if (a.startsWith("--")) {
      console.error(`unknown flag: ${a}`);
      process.exit(4);
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));

const reports = APPS.map((app) => auditApp(app, { namespaceFilter: args.namespaces }));

// Threshold ratchet: each (app, locale) cell records its accepted ceiling.
// Build fails when actual > ceiling. Use --update-threshold whenever
// translation work actually lowers a count, never to widen tolerance.
let regressions = [];
let baseline = null;
if (args.threshold) {
  const tPath = resolve(args.threshold);
  if (existsSync(tPath)) {
    baseline = JSON.parse(readFileSync(tPath, "utf8"));
  } else {
    baseline = { generatedAt: null, apps: {} };
  }

  if (args.updateThreshold) {
    const next = { generatedAt: new Date().toISOString(), apps: {} };
    for (const r of reports) {
      if (r.error) continue;
      next.apps[r.app] = {};
      for (const [locale, info] of Object.entries(r.locales)) {
        next.apps[r.app][locale] = info.total;
      }
    }
    writeFileSync(tPath, JSON.stringify(next, null, 2) + "\n");
    console.error(`updated threshold baseline → ${tPath}`);
    baseline = next;
  } else {
    for (const r of reports) {
      if (r.error) continue;
      const appBaseline = baseline.apps?.[r.app] ?? {};
      for (const [locale, info] of Object.entries(r.locales)) {
        const cap = appBaseline[locale];
        if (typeof cap === "number" && info.total > cap) {
          regressions.push({
            app: r.app,
            locale,
            cap,
            actual: info.total,
            delta: info.total - cap,
          });
        }
      }
    }
  }
}

// Targeted-namespace gate: blocks if any targeted count > max.
let targetedOverflows = [];
if (args.namespaces && args.maxTargeted !== null) {
  for (const r of reports) {
    if (r.error) continue;
    for (const [locale, info] of Object.entries(r.locales)) {
      if (info.targeted > args.maxTargeted) {
        targetedOverflows.push({
          app: r.app,
          locale,
          actual: info.targeted,
          cap: args.maxTargeted,
        });
      }
    }
  }
}

if (args.json) {
  process.stdout.write(
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        namespaces: args.namespaces ? [...args.namespaces] : null,
        threshold: args.threshold,
        reports,
        regressions,
        targetedOverflows,
      },
      null,
      2,
    ) + "\n",
  );
} else {
  const lines = [];
  lines.push("i18n untranslated report");
  lines.push("=========================");
  if (args.namespaces) {
    lines.push(`namespaces filter: ${[...args.namespaces].join(", ")}`);
  }
  if (args.threshold) {
    lines.push(`threshold baseline: ${args.threshold}`);
  }
  let grandTotal = 0;
  let grandTargeted = 0;
  for (const r of reports) {
    if (r.error) {
      lines.push(`\n[${r.app}]  ERROR: ${r.error}`);
      continue;
    }
    lines.push(`\n[${r.app}]  base=${r.baseKeyCount} keys`);
    for (const [locale, info] of Object.entries(r.locales)) {
      grandTotal += info.total;
      grandTargeted += info.targeted;
      const cap = baseline?.apps?.[r.app]?.[locale];
      const capStr = typeof cap === "number" ? ` cap=${cap}` : "";
      const targetedStr = args.namespaces ? ` targeted=${String(info.targeted).padStart(3)}` : "";
      lines.push(
        `  ${locale.padEnd(3)}  untranslated=${String(info.total).padStart(4)}${targetedStr}${capStr}`,
      );
      if (args.verbose && info.keys.length > 0) {
        const sample = args.namespaces ? info.targetedKeys : info.keys;
        for (const k of sample.slice(0, 15)) lines.push(`        - ${k}`);
        if (sample.length > 15) lines.push(`        ... and ${sample.length - 15} more`);
      }
    }
  }
  lines.push("");
  lines.push(`grand total untranslated: ${grandTotal}`);
  if (args.namespaces) {
    lines.push(
      `grand total in targeted namespaces (${[...args.namespaces].join(", ")}): ${grandTargeted}`,
    );
  }
  if (regressions.length > 0) {
    lines.push("");
    lines.push("REGRESSIONS vs threshold baseline:");
    for (const r of regressions) {
      lines.push(`  ${r.app}/${r.locale}: ${r.actual} > cap ${r.cap} (+${r.delta})`);
    }
  }
  if (targetedOverflows.length > 0) {
    lines.push("");
    lines.push(`TARGETED OVERFLOWS (max=${args.maxTargeted}):`);
    for (const o of targetedOverflows) {
      lines.push(`  ${o.app}/${o.locale}: ${o.actual} targeted untranslated`);
    }
  }
  process.stdout.write(lines.join("\n") + "\n");
}

if (regressions.length > 0) process.exit(2);
if (targetedOverflows.length > 0) process.exit(3);
process.exit(0);
