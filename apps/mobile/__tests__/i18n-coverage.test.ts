/**
 * Mobile i18n coverage gate (Sprint 5).
 *
 * Mirror of the web gate in apps/web-v2/lib/i18n/i18n-coverage.test.ts:
 * the mobile catalog has 10 locales (en + 9), 804 keys per locale after
 * Sprint 5. This test pins the parity contract so a new key in en.json
 * cannot ship without a matching entry in every non-en locale — drift
 * would re-introduce the 2-missing-key regression Sprint 5 closed.
 *
 * Untranslated-string warnings (identical-to-en values) stay with the
 * existing scripts/i18n-audit.mjs gate, which is a warn-level CI step
 * pending the translation backlog being closed.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const I18N_DIR = join(__dirname, "..", "i18n");
const LOCALES = readdirSync(I18N_DIR)
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.replace(/\.json$/, ""));

const BASE = "en";
const NON_EN_LOCALES = LOCALES.filter((l) => l !== BASE);

type Catalog = Record<string, unknown>;

function load(locale: string): Catalog {
  return JSON.parse(readFileSync(join(I18N_DIR, `${locale}.json`), "utf8")) as Catalog;
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

const enFlat = flatten(load(BASE));

describe("mobile i18n catalog parity", () => {
  it("ships exactly 10 locales (en + 9)", () => {
    expect(LOCALES.sort()).toEqual(
      ["en", "ar", "de", "es", "fr", "hi", "ja", "ko", "pt", "zh"].sort(),
    );
  });

  it("en has a non-trivial catalog", () => {
    expect(Object.keys(enFlat).length).toBeGreaterThan(700);
  });

  it.each(NON_EN_LOCALES)("%s has the same flattened key set as en", (locale) => {
    const localeFlat = flatten(load(locale));
    const missing = Object.keys(enFlat).filter((k) => !(k in localeFlat));
    const orphans = Object.keys(localeFlat).filter((k) => !(k in enFlat));
    expect(missing, `missing keys in ${locale}: ${missing.slice(0, 10).join(", ")}`).toEqual([]);
    expect(orphans, `orphan keys in ${locale}: ${orphans.slice(0, 10).join(", ")}`).toEqual([]);
  });

  it.each(NON_EN_LOCALES)("%s translates learnerSettings.language* keys", (locale) => {
    const localeFlat = flatten(load(locale));
    // These two keys were the missing-keys regression closed in Sprint 5;
    // pin them so they cannot silently fall back to English again.
    for (const key of ["learnerSettings.language", "learnerSettings.languageDesc"]) {
      expect(localeFlat[key], `${locale} missing ${key}`).toBeTruthy();
      expect(localeFlat[key] === enFlat[key], `${locale} ${key} is identical to English`).toBe(
        false,
      );
    }
  });
});
