/**
 * i18n coverage gate (Sprint 4).
 *
 * Pins what the web learner UI has translated so regressions are
 * impossible to merge silently:
 *
 *   1. Every locale catalog has the same key set as `en.json`.
 *   2. The `learner.*` namespace MUST be present in every locale and
 *      MUST NOT be identical to English (i.e. translations actually
 *      happened for the namespace this sprint adds).
 *   3. Loanwords that legitimately match English in some locales
 *      (e.g. "Notifications" in PT, "Avatar" everywhere) are
 *      allow-listed per locale so they don't trip the assertion.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const MESSAGES_DIR = join(__dirname, "messages");
const LOCALES = readdirSync(MESSAGES_DIR)
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.replace(/\.json$/, ""));

const BASE_LOCALE = "en";
const NON_EN_LOCALES = LOCALES.filter((l) => l !== BASE_LOCALE);

type Catalog = Record<string, unknown>;

function load(locale: string): Catalog {
  return JSON.parse(readFileSync(join(MESSAGES_DIR, `${locale}.json`), "utf8")) as Catalog;
}

function flatten(obj: unknown, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  if (!obj || typeof obj !== "object") return out;
  for (const [k, v] of Object.entries(obj as Catalog)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      Object.assign(out, flatten(v, key));
    } else if (typeof v === "string") {
      out[key] = v;
    }
  }
  return out;
}

const enFlat = flatten(load(BASE_LOCALE));
const learnerKeys = Object.keys(enFlat).filter((k) => k.startsWith("learner."));

// Loanwords / shared lexicon — per-locale list of keys whose value
// legitimately matches English in that locale. Empty by default;
// extend as real translations land.
const LOANWORD_EXEMPT: Record<string, ReadonlySet<string>> = {
  ar: new Set(),
  de: new Set(),
  es: new Set(),
  // "Notifications" is the same word in French; "Conversation" is the
  // same word in PT and FR.
  fr: new Set([
    "learner.notifications.page_title",
    "learner.homework.conversation_aria",
  ]),
  hi: new Set(),
  ja: new Set(),
  ko: new Set(),
  pt: new Set([
    "learner.homework.conversation_aria",
  ]),
  zh: new Set(),
};

describe("web i18n catalog parity", () => {
  it.each(NON_EN_LOCALES)("%s has the same flattened key set as en", (locale) => {
    const localeFlat = flatten(load(locale));
    const missing = Object.keys(enFlat).filter((k) => !(k in localeFlat));
    const orphans = Object.keys(localeFlat).filter((k) => !(k in enFlat));
    expect(missing, `missing keys in ${locale}: ${missing.slice(0, 10).join(", ")}`).toEqual([]);
    expect(orphans, `orphan keys in ${locale}: ${orphans.slice(0, 10).join(", ")}`).toEqual([]);
  });
});

describe("web i18n learner namespace is translated", () => {
  it("en exposes a populated learner namespace", () => {
    expect(learnerKeys.length).toBeGreaterThan(0);
  });

  it.each(NON_EN_LOCALES)("%s translates the learner.* namespace", (locale) => {
    const localeFlat = flatten(load(locale));
    const allow = LOANWORD_EXEMPT[locale] ?? new Set<string>();
    const identical = learnerKeys.filter(
      (k) => !allow.has(k) && localeFlat[k] === enFlat[k] && enFlat[k].length > 1,
    );
    expect(
      identical,
      `${locale}: ${identical.length} learner.* values still identical to en — ${identical.slice(0, 5).join(", ")}`,
    ).toEqual([]);
  });
});
