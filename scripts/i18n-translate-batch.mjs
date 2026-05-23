#!/usr/bin/env node
/**
 * i18n-translate-batch
 * ====================
 *
 * Machine-translate the long tail of untranslated keys produced by
 * `scripts/i18n-audit.mjs`, with safety rails appropriate for a
 * production LMS:
 *
 *   1. Placeholder protection. ICU placeholders like `{{name}}`,
 *      `{count}`, `<0>…</0>`, and HTML tags are swapped for opaque
 *      sentinels before the call to the translation provider and
 *      restored verbatim afterwards. Brand glossary terms (AIVO,
 *      COPPA, IEP, PIN, MFA, Base32, QR, AAC, K-8, GDPR, LGPD) get
 *      the same treatment so they survive intact.
 *
 *   2. Per-namespace batching. Translation is requested one namespace
 *      at a time, so reviewers can stage commits per feature surface
 *      (e.g., review `parentBilling` separately from `learnerStage`).
 *
 *   3. Provider adapters. The default provider is a deterministic
 *      `mock` that simply round-trips the source with a `[loc]` tag,
 *      useful for tests and CI dry runs. Real providers (`deepl`,
 *      `google`) read credentials from the environment and call the
 *      public REST API; they are pluggable via the `--provider` flag.
 *
 *   4. Review mode. `--review` writes a side-by-side diff
 *      (`<en> -> <translated>`) to `tmp/i18n-review-<app>-<loc>.txt`
 *      and does NOT mutate the catalog. `--apply` is required to
 *      write the JSON files. This matches the repo convention of
 *      keeping translation pipelines auditable.
 *
 *   5. Resumability. The script only translates keys whose current
 *      locale value equals the English value (the same "untranslated"
 *      definition used by `i18n-audit.mjs`), so reruns are idempotent
 *      and never overwrite human-curated translations.
 *
 * Usage
 * -----
 *
 *   node scripts/i18n-translate-batch.mjs \
 *     --app mobile --locale fr --namespace parentBilling --review
 *
 *   node scripts/i18n-translate-batch.mjs \
 *     --app mobile --locale fr --namespace parentBilling \
 *     --provider deepl --apply
 *
 *   # All non-English locales for one namespace:
 *   node scripts/i18n-translate-batch.mjs \
 *     --app mobile --namespace parentIEP --provider deepl --apply
 *
 * Environment
 * -----------
 *   DEEPL_API_KEY        Required for `--provider deepl`.
 *   GOOGLE_API_KEY       Required for `--provider google`.
 *   I18N_GLOSSARY_EXTRA  Optional comma-separated list of additional
 *                        glossary terms to preserve verbatim.
 *
 * The script intentionally has no third-party dependencies; it uses
 * the Node 20+ built-in `fetch` and `node:fs` only.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";

// ---------------------------------------------------------------- config

const APPS = {
  mobile: { dir: "apps/mobile/i18n", base: "en" },
  marketing: { dir: "apps/marketing/src/i18n/messages", base: "en" },
};

const BASE_GLOSSARY = [
  "AIVO",
  "COPPA",
  "GDPR",
  "LGPD",
  "FERPA",
  "IEP",
  "PIN",
  "MFA",
  "TOTP",
  "QR",
  "Base32",
  "AAC",
  "K-8",
  "Sage",
  "Brain Clone",
  "Google",
  "Authy",
  "1Password",
  "WebP",
  "JPEG",
  "PNG",
];

const EXTRA_GLOSSARY = (process.env.I18N_GLOSSARY_EXTRA || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const GLOSSARY = [...BASE_GLOSSARY, ...EXTRA_GLOSSARY];

// ---------------------------------------------------------------- CLI

function parseArgs(argv) {
  const out = { provider: "mock" };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      out[key] = true;
    } else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

function usage() {
  console.error(
    "Usage: node scripts/i18n-translate-batch.mjs --app <mobile|marketing> " +
      "[--locale <code>] --namespace <ns> [--provider mock|deepl|google] " +
      "[--review | --apply] [--dry-run]",
  );
  process.exit(2);
}

// ---------------------------------------------------------------- helpers

function loadJSON(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function saveJSON(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n", "utf8");
}

/** Flatten a nested JSON catalog into `{ "ns.key": "value" }` pairs. */
function flatten(obj, prefix = "", out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      flatten(v, key, out);
    } else if (typeof v === "string") {
      out[key] = v;
    }
  }
  return out;
}

/** Write a flat-key value back into a nested catalog. */
function setNested(obj, dottedKey, value) {
  const parts = dottedKey.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (typeof cur[p] !== "object" || cur[p] === null) cur[p] = {};
    cur = cur[p];
  }
  cur[parts.at(-1)] = value;
}

// ---------------------------------------------- placeholder protection

const PLACEHOLDER_PATTERNS = [
  /\{\{[^}]+\}\}/g, // {{name}}
  /\{[^}]+\}/g, //   {name}
  /<\d+>[\s\S]*?<\/\d+>/g, // <0>...</0>
  /<[^<>]+>/g, // generic HTML tags
];

/** Returns { masked, tokens } where `masked` has @@T0@@, @@T1@@ tokens. */
function protect(input, glossary) {
  const tokens = [];
  let masked = input;
  const push = (m) => {
    const t = `@@T${tokens.length}@@`;
    tokens.push(m);
    return t;
  };
  for (const re of PLACEHOLDER_PATTERNS) masked = masked.replace(re, push);
  for (const term of glossary) {
    // word-boundary safe match; escape regex meta-chars in the term
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    masked = masked.replace(new RegExp(`\\b${escaped}\\b`, "g"), push);
  }
  return { masked, tokens };
}

function restore(translated, tokens) {
  let out = translated;
  for (let i = 0; i < tokens.length; i++) {
    out = out.split(`@@T${i}@@`).join(tokens[i]);
  }
  return out;
}

// ---------------------------------------------------------------- providers

/** No-op provider for tests / CI dry runs. */
function mockProvider() {
  return async function translate(texts, targetLang) {
    return texts.map((t) => `[${targetLang}] ${t}`);
  };
}

/** DeepL REST API. Free tier endpoint chosen by env var. */
function deeplProvider() {
  const key = process.env.DEEPL_API_KEY;
  if (!key) throw new Error("DEEPL_API_KEY is required for --provider deepl");
  const base = key.endsWith(":fx")
    ? "https://api-free.deepl.com/v2/translate"
    : "https://api.deepl.com/v2/translate";
  return async function translate(texts, targetLang) {
    const params = new URLSearchParams();
    params.append("auth_key", key);
    for (const t of texts) params.append("text", t);
    params.append("target_lang", targetLang.toUpperCase().replace("PT", "PT-PT"));
    params.append("preserve_formatting", "1");
    params.append("tag_handling", "xml");
    const res = await fetch(base, { method: "POST", body: params });
    if (!res.ok) throw new Error(`DeepL ${res.status}: ${await res.text()}`);
    const json = await res.json();
    return json.translations.map((x) => x.text);
  };
}

/** Google Cloud Translation v2. */
function googleProvider() {
  const key = process.env.GOOGLE_API_KEY;
  if (!key) throw new Error("GOOGLE_API_KEY is required for --provider google");
  const url = `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(key)}`;
  return async function translate(texts, targetLang) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ q: texts, target: targetLang, format: "text" }),
    });
    if (!res.ok) throw new Error(`Google ${res.status}: ${await res.text()}`);
    const json = await res.json();
    return json.data.translations.map((x) => x.translatedText);
  };
}

const PROVIDERS = {
  mock: mockProvider,
  deepl: deeplProvider,
  google: googleProvider,
};

// ---------------------------------------------------------------- core

/** Translate one namespace for one locale. Returns array of edits. */
async function translateNamespace({ app, locale, namespace, provider, glossary }) {
  const { dir, base } = APPS[app];
  const enPath = join(dir, `${base}.json`);
  const locPath = join(dir, `${locale}.json`);
  if (!existsSync(enPath)) throw new Error(`missing ${enPath}`);
  if (!existsSync(locPath)) throw new Error(`missing ${locPath}`);

  const en = loadJSON(enPath);
  const lo = loadJSON(locPath);
  const enFlat = flatten(en);
  const loFlat = flatten(lo);

  const targets = Object.keys(enFlat).filter((k) => {
    if (!k.startsWith(`${namespace}.`) && k !== namespace) return false;
    return loFlat[k] === enFlat[k]; // same as English ⇒ untranslated
  });

  if (targets.length === 0) {
    return { edits: [], locPath, locData: lo };
  }

  const masked = targets.map((k) => protect(enFlat[k], glossary));
  const translatedMasked = await provider(masked.map((m) => m.masked), locale);
  const edits = targets.map((k, i) => ({
    key: k,
    en: enFlat[k],
    translated: restore(translatedMasked[i], masked[i].tokens),
  }));

  return { edits, locPath, locData: lo };
}

// ---------------------------------------------------------------- main

async function main() {
  const args = parseArgs(process.argv);
  if (!args.app || !APPS[args.app] || !args.namespace) usage();
  if (args.apply && args.review) {
    console.error("Choose either --apply or --review, not both.");
    process.exit(2);
  }
  const providerFactory = PROVIDERS[args.provider];
  if (!providerFactory) {
    console.error(`Unknown --provider ${args.provider}; expected one of: ${Object.keys(PROVIDERS).join(", ")}`);
    process.exit(2);
  }
  const provider = providerFactory();

  const { dir, base } = APPS[args.app];
  const allLocales = [];
  for (const file of (await import("node:fs")).readdirSync(dir)) {
    if (!file.endsWith(".json")) continue;
    const code = file.replace(/\.json$/, "");
    if (code !== base) allLocales.push(code);
  }
  const locales = args.locale ? [args.locale] : allLocales;

  let totalEdits = 0;
  for (const locale of locales) {
    const { edits, locPath, locData } = await translateNamespace({
      app: args.app,
      locale,
      namespace: args.namespace,
      provider,
      glossary: GLOSSARY,
    });
    if (edits.length === 0) {
      console.log(`${args.app}/${locale}/${args.namespace}: nothing to translate`);
      continue;
    }

    if (args.review || (!args.apply && !args["dry-run"])) {
      const outDir = "tmp";
      mkdirSync(outDir, { recursive: true });
      const out = join(outDir, `i18n-review-${args.app}-${locale}-${args.namespace}.txt`);
      const body = edits
        .map((e) => `${e.key}\n  EN: ${e.en}\n  ${locale.toUpperCase()}: ${e.translated}\n`)
        .join("\n");
      writeFileSync(out, body, "utf8");
      console.log(`${args.app}/${locale}/${args.namespace}: wrote ${edits.length} candidates to ${out}`);
    }

    if (args.apply) {
      for (const e of edits) setNested(locData, e.key, e.translated);
      saveJSON(locPath, locData);
      console.log(`${args.app}/${locale}/${args.namespace}: applied ${edits.length} translations`);
    }
    totalEdits += edits.length;
  }
  console.log(`Total candidates: ${totalEdits}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
