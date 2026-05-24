export type ItemVariantStatus = "active" | "retired" | "experimental";

export interface ItemVariant {
  /** Stable id, unique within the bank — typically `${itemId}@${version}`. */
  id: string;
  /** Parent item id. */
  itemId: string;
  /** Semver version of the variant. Bump for ANY content change. */
  version: string;
  /** Variant lifecycle status. */
  status: ItemVariantStatus;
  /**
   * Cohort weight used by the cohort-router. Values 0..1. Variants with
   * higher weight receive proportionally more traffic. A retired variant's
   * weight is ignored even if non-zero — `pickVariant` filters it out.
   */
  cohortWeight: number;
  /** ISO-8601 publish date of this variant. */
  publishedAt: string;
  /** Free-form payload — the actual question stem, choices, key, etc. */
  body: Record<string, unknown>;
  /** Defect count — increments via `registerDefect`. */
  defectCount: number;
  /** Optional learner surface type for runtime rendering. */
  surfaceType?: "choice_grid" | "scratchpad" | "math_expression" | "geometry_workspace" | "video" | "audio";
  /** Optional variant assets used by surface renderers. */
  assets?: ItemAsset[];
}

export type ItemAsset =
  | { type: "media"; src: string; mimeType?: string }
  | { type: "image"; src: string; alt?: string }
  | { type: "captions"; src: string; lang: string; label?: string; default?: boolean };

export interface Item {
  /** Stable id, unique across all banks. */
  id: string;
  /** Skill-graph skill the item assesses. */
  skillId: string;
  /** Authoring metadata. */
  authoringMeta?: Record<string, string>;
  /** Variants of this item; at least one MUST be `active` for the item
   *  to be routable. */
  variants: ItemVariant[];
}

export interface ItemBank {
  /** Stable id (e.g. `"k-math-fall-2026"`). */
  id: string;
  /** Schema version — bump when this file's types change. */
  schemaVersion: 1;
  items: Item[];
  /** Auto-retire variants whose defectCount ≥ defectBudget. */
  defectBudget: number;
}

export interface ItemDefect {
  variantId: string;
  /** Reporter-supplied category. */
  category: "ambiguous_stem" | "no_correct" | "multi_correct" | "asset_broken" | "bias" | "other";
  /** Human-readable detail. */
  detail: string;
  /** ISO-8601. */
  reportedAt: string;
}
