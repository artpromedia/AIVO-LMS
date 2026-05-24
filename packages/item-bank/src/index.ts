/**
 * @aivo/item-bank — versioned assessment items with cohort routing and
 * defect tracking (§9.3 Greenfield 6–8w).
 *
 * Concepts:
 *
 *   - `Item` — a stable assessment item id; the *concept* (e.g. "count-3").
 *   - `ItemVariant` — a concrete authored version of an item; immutable.
 *     New variants get a new semver string (e.g. "1.2.0").
 *   - `ItemBank` — a content-pack-scoped collection of items + variants.
 *   - Cohort routing — given a learnerId + item, deterministically pick a
 *     non-retired variant. Used for A/B experiments and item refreshes.
 *   - Defect tracking — flagged-defect counts per variant; once a variant
 *     exceeds the configured defect budget, it is auto-retired.
 *
 * The service layer (assessment-svc) persists variants in postgres and
 * uses these primitives to choose the variant for each learner-attempt.
 * This package is pure and storage-agnostic.
 */
export type { Item, ItemVariant, ItemBank, ItemDefect, ItemVariantStatus, ItemAsset } from "./types.js";
export { pickVariant, registerDefect, retireVariant } from "./routing.js";
export {
  validateItemVariant,
  type ItemVariantIssue,
  type ItemVariantIssueCode,
} from "./validate.js";
