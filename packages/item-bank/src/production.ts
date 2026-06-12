/**
 * Production item-bank loader (Sprint 3).
 *
 * Centralises access to the four production seed banks
 * (math / ela / science / writing) so callers — apps/web-v2/lib/db/seed.ts,
 * services/assessment-svc, the validate script — never reach into
 * individual seed files. Anything that depends on production items
 * should import from this module.
 *
 * Fixtures (`packages/item-bank/fixtures/**`) remain available for
 * tests / Storybook / lesson-player smoke; they are intentionally NOT
 * surfaced here so production code paths cannot accidentally consume
 * them.
 */
import type { Item, ItemBank } from "./types.js";
import { MATH_PRODUCTION_ITEMS } from "./seed-math.js";
import { ELA_PRODUCTION_ITEMS } from "./seed-ela.js";
import { SCIENCE_PRODUCTION_ITEMS } from "./seed-science.js";
import { WRITING_PRODUCTION_ITEMS } from "./seed-writing.js";
import { SEL_PRODUCTION_ITEMS } from "./seed-sel.js";
import { SPEECH_PRODUCTION_ITEMS } from "./seed-speech.js";
import { EXECUTIVE_FUNCTION_PRODUCTION_ITEMS } from "./seed-executive-function.js";
import { LIFE_SKILLS_PRODUCTION_ITEMS } from "./seed-life-skills.js";
import {
  CODING_PRODUCTION_ITEMS,
  CREATIVE_ARTS_PRODUCTION_ITEMS,
  GEOGRAPHY_PRODUCTION_ITEMS,
  MUSIC_PRODUCTION_ITEMS,
  PE_HEALTH_PRODUCTION_ITEMS,
  SOCIAL_STUDIES_PRODUCTION_ITEMS,
  STEM_ENGINEERING_PRODUCTION_ITEMS,
  WORLD_LANGUAGES_PRODUCTION_ITEMS,
} from "./seed-expansion-subjects.js";
import { PREK_FOUNDATION_ITEMS } from "./seed-prek-foundations.js";
import { IMPORTED_PRODUCTION_ITEMS } from "./imported-items.js";

export type RequiredSubjectSlug =
  | "math"
  | "ela"
  | "science"
  | "writing"
  | "sel"
  | "speech"
  | "executive_function"
  | "life_skills"
  | "creative_arts"
  | "social_studies"
  | "world_languages"
  | "coding"
  | "geography"
  | "music"
  | "pe_health"
  | "stem_engineering";

/** Items landed via `pnpm item-bank:import` (Sprint 05 — the import CLI
 *  persists for real; see cli/file-persist.ts). Merged per subject below. */
function importedFor(subject: RequiredSubjectSlug): Item[] {
  return IMPORTED_PRODUCTION_ITEMS.filter((entry) => entry.subject === subject).map(
    (entry) => entry.item as Item,
  );
}

const SUBJECT_ITEMS: Record<RequiredSubjectSlug, readonly Item[]> = {
  math: [...PREK_FOUNDATION_ITEMS.math, ...MATH_PRODUCTION_ITEMS, ...importedFor("math")],
  ela: [...PREK_FOUNDATION_ITEMS.ela, ...ELA_PRODUCTION_ITEMS, ...importedFor("ela")],
  science: [...PREK_FOUNDATION_ITEMS.science, ...SCIENCE_PRODUCTION_ITEMS, ...importedFor("science")],
  writing: [...PREK_FOUNDATION_ITEMS.writing, ...WRITING_PRODUCTION_ITEMS, ...importedFor("writing")],
  sel: [...PREK_FOUNDATION_ITEMS.sel, ...SEL_PRODUCTION_ITEMS, ...importedFor("sel")],
  speech: [...PREK_FOUNDATION_ITEMS.speech, ...SPEECH_PRODUCTION_ITEMS, ...importedFor("speech")],
  executive_function: [
    ...PREK_FOUNDATION_ITEMS.executive_function,
    ...EXECUTIVE_FUNCTION_PRODUCTION_ITEMS,
    ...importedFor("executive_function"),
  ],
  life_skills: [...PREK_FOUNDATION_ITEMS.life_skills, ...LIFE_SKILLS_PRODUCTION_ITEMS, ...importedFor("life_skills")],
  creative_arts: [...PREK_FOUNDATION_ITEMS.creative_arts, ...CREATIVE_ARTS_PRODUCTION_ITEMS, ...importedFor("creative_arts")],
  social_studies: [...PREK_FOUNDATION_ITEMS.social_studies, ...SOCIAL_STUDIES_PRODUCTION_ITEMS, ...importedFor("social_studies")],
  world_languages: [...PREK_FOUNDATION_ITEMS.world_languages, ...WORLD_LANGUAGES_PRODUCTION_ITEMS, ...importedFor("world_languages")],
  coding: [...PREK_FOUNDATION_ITEMS.coding, ...CODING_PRODUCTION_ITEMS, ...importedFor("coding")],
  geography: [...PREK_FOUNDATION_ITEMS.geography, ...GEOGRAPHY_PRODUCTION_ITEMS, ...importedFor("geography")],
  music: [...PREK_FOUNDATION_ITEMS.music, ...MUSIC_PRODUCTION_ITEMS, ...importedFor("music")],
  pe_health: [...PREK_FOUNDATION_ITEMS.pe_health, ...PE_HEALTH_PRODUCTION_ITEMS, ...importedFor("pe_health")],
  stem_engineering: [...PREK_FOUNDATION_ITEMS.stem_engineering, ...STEM_ENGINEERING_PRODUCTION_ITEMS, ...importedFor("stem_engineering")],
};

/** Default defect budget for production banks — auto-retire variants
 *  that accumulate 5 defect reports without manual intervention. */
const DEFAULT_DEFECT_BUDGET = 5;

/** All production items across the four required subjects. */
export function getAllProductionItems(): Item[] {
  return Object.values(SUBJECT_ITEMS).flatMap((items) => [...items]);
}

/** Items for one required subject. */
export function getProductionItemsForSubject(subject: RequiredSubjectSlug): readonly Item[] {
  return SUBJECT_ITEMS[subject];
}

/** Construct an ItemBank wrapper for one required subject. */
export function getProductionBankForSubject(
  subject: RequiredSubjectSlug,
  defectBudget: number = DEFAULT_DEFECT_BUDGET,
): ItemBank {
  return {
    id: `prod-${subject}-2026`,
    schemaVersion: 1,
    items: [...SUBJECT_ITEMS[subject]],
    defectBudget,
  };
}

/** A single combined production bank across all required subjects. */
export function getCombinedProductionBank(defectBudget: number = DEFAULT_DEFECT_BUDGET): ItemBank {
  return {
    id: "prod-required-subjects-2026",
    schemaVersion: 1,
    items: getAllProductionItems(),
    defectBudget,
  };
}

/** Item counts per required subject — used by the validate script and
 *  the curriculum-coverage gate for fast sanity checks. */
export function getProductionItemCounts(): Record<RequiredSubjectSlug, number> {
  return Object.fromEntries(
    Object.entries(SUBJECT_ITEMS).map(([subject, items]) => [subject, items.length]),
  ) as Record<RequiredSubjectSlug, number>;
}
