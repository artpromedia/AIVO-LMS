/**
 * Sprint C-03 — truthful, strengths-first reveal: i18n catalog gate.
 *
 * Pins three things across all 10 locale catalogs so the falsehoods this
 * sprint deleted can never silently return:
 *
 *   1. The deleted keys (fabricated grade-equivalent/gap cards, the
 *      "Encrypted (AES-256)" chip, the unhonored versioning/rollback and
 *      "no personal data leaves this device" claims) are absent everywhere.
 *   2. Every locale carries exactly the same `brain_clone` key set as en
 *      (Decision D7 — key parity), including the new strengths-stage and
 *      qualitative-estimate keys, with matching ICU placeholders.
 *   3. No parent-facing `brain_clone` string claims encryption or renders
 *      grade-gap framing ("AES", "Gap:").
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const MESSAGES_DIR = join(__dirname, "messages");
const LOCALES = readdirSync(MESSAGES_DIR)
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.replace(/\.json$/, ""));
const NON_EN_LOCALES = LOCALES.filter((l) => l !== "en");

type Catalog = Record<string, unknown>;

function load(locale: string): Catalog {
  return JSON.parse(readFileSync(join(MESSAGES_DIR, `${locale}.json`), "utf8")) as Catalog;
}

function brainClone(locale: string): Record<string, string> {
  return load(locale).brain_clone as Record<string, string>;
}

function learnerTeam(locale: string): Record<string, string> {
  const parent = load(locale).parent as Catalog;
  return parent.learner_team as Record<string, string>;
}

/** Keys deleted by C-03 — each carried a claim the backend cannot honor or a
 *  fabricated number. Deletion is shippable progress; never re-add silently. */
const REMOVED_KEYS = [
  "building_gap",
  "building_level",
  "building_enrolled",
  "building_activation_encrypted",
  "building_activation_version",
  "building_activation_rollback",
  "clone_privacy_pii",
  "clone_privacy_versioned",
] as const;

/** Keys added by C-03 — the strengths stage, qualitative estimates, and the
 *  truthful privacy line. */
const ADDED_KEYS = [
  "building_strengths_title",
  "building_strengths_caption",
  "building_strengths_goodat_label",
  "building_strengths_loves_label",
  "building_strengths_motivates_label",
  "building_strengths_subject_label",
  "building_strengths_empty",
  "building_estimate_new",
  "building_estimate_growing",
  "building_estimate_confident",
  "building_estimate_advanced",
  "privacy_family",
  "watch_privacy_link",
  "watch_eyebrow",
] as const;

const TEAM_STATUS_KEYS = [
  "status_pending",
  "status_accepted",
  "status_declined",
  "status_revoked",
] as const;

function placeholders(value: string): string[] {
  return [...value.matchAll(/\{(\w+)/g)].map((m) => m[1]).sort();
}

describe("brain_clone catalog (C-03)", () => {
  it.each(LOCALES)("%s carries none of the deleted falsehood keys", (locale) => {
    const keys = Object.keys(brainClone(locale));
    const present = REMOVED_KEYS.filter((k) => keys.includes(k));
    expect(present, `${locale} still defines deleted keys`).toEqual([]);
  });

  it.each(LOCALES)("%s defines every key C-03 added", (locale) => {
    const block = brainClone(locale);
    const missing = ADDED_KEYS.filter((k) => !(k in block) || block[k].length === 0);
    expect(missing, `${locale} is missing new keys`).toEqual([]);
  });

  it.each(NON_EN_LOCALES)("%s brain_clone key set matches en exactly", (locale) => {
    const en = Object.keys(brainClone("en")).sort();
    const other = Object.keys(brainClone(locale)).sort();
    expect(other).toEqual(en);
  });

  it.each(NON_EN_LOCALES)("%s brain_clone ICU placeholders match en", (locale) => {
    const en = brainClone("en");
    const other = brainClone(locale);
    for (const [key, value] of Object.entries(en)) {
      expect(
        placeholders(other[key]),
        `${locale}.brain_clone.${key} placeholders diverge from en`,
      ).toEqual(placeholders(value));
    }
  });

  it.each(LOCALES)("%s brain_clone values never claim encryption or grade gaps", (locale) => {
    const offenders = Object.entries(brainClone(locale)).filter(
      ([, value]) => /AES/i.test(value) || /Gap:/.test(value),
    );
    expect(offenders, `${locale} carries a falsehood string`).toEqual([]);
  });

  it("en parent copy avoids systems vocabulary in stage titles", () => {
    const en = brainClone("en");
    const stageTitleKeys = Object.keys(en).filter(
      (k) =>
        k.startsWith("watch_step_") ||
        /^building_(title|subtitle|template_pill|strengths_title|domains_title|accommodations_title|activation_title|tutors_title|complete_title)$/.test(
          k,
        ),
    );
    const offenders = stageTitleKeys.filter((k) =>
      /\b(template|system|master)\b|v\d+\.\d+/i.test(en[k]),
    );
    expect(offenders, "stage titles must speak parent language").toEqual([]);
  });
});

describe("parent.learner_team invite statuses (C-03)", () => {
  it.each(LOCALES)("%s defines humanized status labels", (locale) => {
    const block = learnerTeam(locale);
    const missing = TEAM_STATUS_KEYS.filter((k) => !(k in block) || block[k].length === 0);
    expect(missing, `${locale} is missing status keys`).toEqual([]);
    // The label must be human language, never the raw enum constant.
    for (const key of TEAM_STATUS_KEYS) {
      expect(block[key]).not.toMatch(/^(PENDING|ACCEPTED|DECLINED|REVOKED)$/);
    }
  });
});
