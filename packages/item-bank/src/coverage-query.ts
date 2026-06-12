/**
 * Coverage queries over the production item banks (Sprint 01 — honest
 * coverage gate).
 *
 * `scripts/curriculum-coverage-check.mjs` (the `curriculum:coverage` gate)
 * and the tutor-registry tests both need to answer one question with one
 * authoritative implementation: *how many real, active production items
 * back a given (subject, grade band)?* Before this module the gate trusted
 * a hand-maintained `production-manifest.json`, which let declared coverage
 * drift above the real item set. Everything that needs item counts must go
 * through here so the numbers can never disagree.
 */
import type { Item } from "./types.js";
import { getProductionItemsForSubject, type RequiredSubjectSlug } from "./production.js";
import { gradeBandFromSkillId } from "./seed-baseline-fallback.js";

/** Grade bands the coverage gate reasons about (tutor `coverageMatrix` keys
 *  minus ADULT, which no item bank currently encodes). */
export type CoverageGradeBand =
  | "PRE_K"
  | "K"
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "11"
  | "12";

export const COVERAGE_GRADE_BANDS: readonly CoverageGradeBand[] = [
  "PRE_K",
  "K",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
];

/**
 * Decode the grade band an item belongs to from its `skillId`.
 *
 * - PRE_K foundations use `prek.<subject>.<skill>` skillIds that carry no
 *   numeric/`K` token, so they are special-cased ahead of the shared
 *   decoder (`gradeBandFromSkillId` would return `null` for them).
 * - `gradeBandFromSkillId` returns `"PK"` for explicit `.PK.` tokens —
 *   normalised to `"PRE_K"` here so callers only see matrix-shaped bands.
 */
export function gradeBandForItem(item: Pick<Item, "skillId">): CoverageGradeBand | null {
  if (!item.skillId) return null;
  if (/^prek[.-]/i.test(item.skillId)) return "PRE_K";
  // NGSS middle-school codes carry an explicit grade suffix:
  // "ngss.MS-LS1-1.g6" → grade 6.
  const gSuffix = item.skillId.match(/\.g(\d{1,2})$/i);
  if (gSuffix) {
    const n = Number(gSuffix[1]);
    if (n >= 1 && n <= 12) return String(n) as CoverageGradeBand;
  }
  // NGSS elementary codes lead the code segment with the grade:
  // "ngss.K-PS2-1" → K, "ngss.3-LS1-1" → 3.
  const ngss = item.skillId.match(/^ngss\.(K|\d{1,2})-/i);
  if (ngss) {
    const tok = ngss[1].toUpperCase();
    if (tok === "K") return "K";
    const n = Number(tok);
    if (n >= 1 && n <= 12) return String(n) as CoverageGradeBand;
  }
  const band = gradeBandFromSkillId(item.skillId);
  if (band === null) return null;
  if (band === "PK") return "PRE_K";
  return band as CoverageGradeBand;
}

function activeItems(subject: RequiredSubjectSlug): readonly Item[] {
  return getProductionItemsForSubject(subject).filter((item) =>
    item.variants.some((variant) => variant.status === "active"),
  );
}

/**
 * Count the production items (with at least one active variant) that back
 * one (subject, grade band) cell. This is THE number the coverage gate's
 * promotion guard compares against `MIN_AUTHORED_ITEMS_PER_BAND` — an
 * `authored` coverageMatrix cell without enough real items here is a lie
 * and fails the gate.
 */
export function countAuthoredItems(subject: RequiredSubjectSlug, gradeBand: string): number {
  return activeItems(subject).filter((item) => gradeBandForItem(item) === gradeBand).length;
}

/** Per-band counts for one subject, over every band in the matrix. */
export function authoredItemCountsByBand(
  subject: RequiredSubjectSlug,
): Record<CoverageGradeBand, number> {
  const counts = Object.fromEntries(COVERAGE_GRADE_BANDS.map((band) => [band, 0])) as Record<
    CoverageGradeBand,
    number
  >;
  for (const item of activeItems(subject)) {
    const band = gradeBandForItem(item);
    if (band !== null) counts[band] += 1;
  }
  return counts;
}
