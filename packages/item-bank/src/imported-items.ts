/**
 * Imported production items — the durable store behind `item-bank:import`.
 *
 * Remediation Sprint 05: the import CLI used to validate authored items and
 * then throw them away (NULL persist adapter). It now converts each
 * `AuthoredItem` to a runtime `Item` and REWRITES THIS FILE, so imported
 * items become part of the production banks (`getProductionItemsForSubject`)
 * and the coverage gate counts them like any seed item.
 *
 * ⚠️ AUTO-MANAGED by `pnpm item-bank:import` (see cli/file-persist.ts).
 * The CLI rewrites the whole file from a template; hand-edits to the DATA
 * array will be preserved only until the next import run. Author items in
 * JSON/YAML files and import them instead of editing this file.
 */
import type { Item } from "./types.js";

export interface ImportedProductionItem {
  /** Item-bank subject slug (RequiredSubjectSlug), already mapped from the
   *  authored brand slug by the import adapter. */
  subject: string;
  item: Item;
}

// prettier-ignore
export const IMPORTED_PRODUCTION_ITEMS: ReadonlyArray<ImportedProductionItem> = [];
