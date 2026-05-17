import type { Item, ItemBank, ItemDefect, ItemVariant } from "./types.js";

/**
 * Stable 32-bit FNV-1a hash. Used to deterministically partition learners
 * across cohort variants — the same (learnerId, itemId) tuple always
 * produces the same hash, so a learner sees the same variant on retry.
 */
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Pick the variant a learner should see for a given item. Deterministic
 * by (learnerId, itemId) so retries are stable; weighted by each
 * variant's `cohortWeight`. Retired variants are excluded.
 *
 * Returns null if no eligible variant exists.
 */
export function pickVariant(
  item: Item,
  learnerId: string,
): ItemVariant | null {
  const eligible = item.variants.filter((v) => v.status !== "retired" && v.cohortWeight > 0);
  if (eligible.length === 0) return null;
  if (eligible.length === 1) return eligible[0];

  const total = eligible.reduce((s, v) => s + v.cohortWeight, 0);
  // Map the FNV hash into [0, total) so all of the weight space is reachable.
  const hash = fnv1a(`${learnerId}:${item.id}`);
  const pos = (hash / 0xffffffff) * total;
  let acc = 0;
  for (const v of eligible) {
    acc += v.cohortWeight;
    if (pos < acc) return v;
  }
  // Floating-point rounding fallback.
  return eligible[eligible.length - 1];
}

/**
 * Register a defect against a variant. Mutates the bank in-place: bumps
 * the variant's `defectCount` and, if it crosses the bank's defectBudget
 * threshold, marks the variant as retired. Returns the post-mutation
 * variant.
 */
export function registerDefect(
  bank: ItemBank,
  defect: ItemDefect,
): ItemVariant | null {
  for (const item of bank.items) {
    const variant = item.variants.find((v) => v.id === defect.variantId);
    if (!variant) continue;
    variant.defectCount++;
    if (variant.defectCount >= bank.defectBudget && variant.status !== "retired") {
      variant.status = "retired";
    }
    return variant;
  }
  return null;
}

/** Manually retire a variant (e.g. after editorial review). */
export function retireVariant(bank: ItemBank, variantId: string): ItemVariant | null {
  for (const item of bank.items) {
    const variant = item.variants.find((v) => v.id === variantId);
    if (variant) {
      variant.status = "retired";
      return variant;
    }
  }
  return null;
}
