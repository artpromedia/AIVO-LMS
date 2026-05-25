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

export type RequiredSubjectSlug = "math" | "ela" | "science" | "writing";

const SUBJECT_ITEMS: Record<RequiredSubjectSlug, readonly Item[]> = {
  math: MATH_PRODUCTION_ITEMS,
  ela: ELA_PRODUCTION_ITEMS,
  science: SCIENCE_PRODUCTION_ITEMS,
  writing: WRITING_PRODUCTION_ITEMS,
};

/** Default defect budget for production banks — auto-retire variants
 *  that accumulate 5 defect reports without manual intervention. */
const DEFAULT_DEFECT_BUDGET = 5;

/** All production items across the four required subjects. */
export function getAllProductionItems(): Item[] {
  return [
    ...MATH_PRODUCTION_ITEMS,
    ...ELA_PRODUCTION_ITEMS,
    ...SCIENCE_PRODUCTION_ITEMS,
    ...WRITING_PRODUCTION_ITEMS,
  ];
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
export function getCombinedProductionBank(
  defectBudget: number = DEFAULT_DEFECT_BUDGET,
): ItemBank {
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
  return {
    math: MATH_PRODUCTION_ITEMS.length,
    ela: ELA_PRODUCTION_ITEMS.length,
    science: SCIENCE_PRODUCTION_ITEMS.length,
    writing: WRITING_PRODUCTION_ITEMS.length,
  };
}
