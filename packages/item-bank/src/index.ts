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
export type { Item, ItemVariant, ItemBank, ItemDefect, ItemVariantStatus } from "./types.js";
export { pickVariant, registerDefect, retireVariant } from "./routing.js";
export {
  validateItemVariant,
  type ItemVariantIssue,
  type ItemVariantIssueCode,
} from "./validate.js";

// Sprint 2.2 — authoring schema + import pipeline.
export {
  AuthoredItem,
  AuthoredItemBank,
  ItemSurfaceType,
  GradeBand,
  ItemAsset,
  Correctness,
  IrtParams,
  Accessibility,
  ITEM_BANK_SCHEMA_VERSION,
  buildCoverageReport,
  type CoverageReport,
  type CoverageRow,
} from "./schema.js";
export {
  runImport,
  NULL_PERSIST_ADAPTER,
  type ImportSummary,
  type ImportIssue,
  type ImportOptions,
  type PersistAdapter,
} from "./cli/import.js";

// Sprint 2 — production seed banks (K-8 coverage for required subjects).
export { MATH_PRODUCTION_ITEMS } from "./seed-math.js";
export { ELA_PRODUCTION_ITEMS } from "./seed-ela.js";
export { SCIENCE_PRODUCTION_ITEMS } from "./seed-science.js";
export { WRITING_PRODUCTION_ITEMS } from "./seed-writing.js";
export {
  CODING_PRODUCTION_ITEMS,
  CREATIVE_ARTS_PRODUCTION_ITEMS,
  GEOGRAPHY_PRODUCTION_ITEMS,
  MUSIC_PRODUCTION_ITEMS,
  PE_HEALTH_PRODUCTION_ITEMS,
  SOCIAL_STUDIES_PRODUCTION_ITEMS,
  STEM_ENGINEERING_PRODUCTION_ITEMS,
  WORLD_LANGUAGES_PRODUCTION_ITEMS,
} from "./seed-expansion-subjects.js";
export { PREK_FOUNDATION_ITEMS, type PreKSubject } from "./seed-prek-foundations.js";

// Sprint 3 — production loader. Use these helpers instead of importing
// the seed-* modules directly so production callers can never accidentally
// reach into fixtures.
export {
  getAllProductionItems,
  getProductionItemsForSubject,
  getProductionBankForSubject,
  getCombinedProductionBank,
  getProductionItemCounts,
  type RequiredSubjectSlug,
} from "./production.js";

// Sprint 3 — surface-type routability check (mirror of SurfaceRouter coverage).
export { ROUTABLE_SURFACE_TYPES } from "./validate.js";

// Sprint 3 (baseline) — fallback bank for assessment-svc when ai-svc
// cannot generate a baseline. Spans all seven required baseline
// subjects; kept separate from production.ts so the curriculum
// coverage scanner stays scoped to math/ela/science/writing.
export { SEL_PRODUCTION_ITEMS } from "./seed-sel.js";
export { LIFE_SKILLS_PRODUCTION_ITEMS } from "./seed-life-skills.js";
export { EXECUTIVE_FUNCTION_PRODUCTION_ITEMS } from "./seed-executive-function.js";
export { SPEECH_PRODUCTION_ITEMS } from "./seed-speech.js";
export {
  BASELINE_FALLBACK_BANK,
  BASELINE_FALLBACK_SUBJECTS,
  gradeBandFromSkillId,
  itemToBaselineQuestion,
  pickFallbackBaseline,
  type BaselineFallbackQuestion,
  type BaselineFallbackSubject,
  type PickFallbackBaselineParams,
  type PickFallbackBaselineResult,
} from "./seed-baseline-fallback.js";
