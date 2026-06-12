/**
 * Remediation Sprint 05 — the REAL default persist adapter for
 * `item-bank:import`.
 *
 * Converts each validated `AuthoredItem` into a runtime `Item` (one active
 * 1.0.0 variant) and rewrites `src/imported-items.ts`, the generated module
 * the production loader merges into `getProductionItemsForSubject`. Importing
 * is idempotent: re-importing an item id replaces its entry. This closes the
 * audit gap where the import pipeline validated content and then silently
 * discarded it (NULL adapter).
 */
import { promises as fs } from "node:fs";
import * as path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { AuthoredItem } from "../schema.js";
import type { Item, ItemVariant } from "../types.js";
import { ROUTABLE_SURFACE_TYPES } from "../validate.js";
import type { PersistAdapter } from "./import.js";

/** Brand learner-subject slug → item-bank RequiredSubjectSlug. */
export const BRAND_SLUG_TO_BANK_SUBJECT: Readonly<Record<string, string>> = {
  math: "math",
  reading: "ela",
  ela: "ela",
  writing: "writing",
  science: "science",
  social: "sel",
  sel: "sel",
  speech: "speech",
  "executive-function": "executive_function",
  executive_function: "executive_function",
  life: "life_skills",
  life_skills: "life_skills",
  art: "creative_arts",
  creative_arts: "creative_arts",
  "social-studies": "social_studies",
  social_studies: "social_studies",
  "world-languages": "world_languages",
  world_languages: "world_languages",
  coding: "coding",
  geography: "geography",
  music: "music",
  "physical-education": "pe_health",
  pe_health: "pe_health",
  engineering: "stem_engineering",
  stem_engineering: "stem_engineering",
};

/** Convert one validated AuthoredItem into the runtime Item shape. */
export function authoredToRuntimeItem(authored: AuthoredItem): Item {
  const correctAnswer =
    authored.correctness.kind === "exact"
      ? authored.correctness.answer
      : authored.correctness.kind === "set"
        ? authored.correctness.answers[0]
        : undefined;
  const body: Record<string, unknown> = { stem: authored.stem };
  if (correctAnswer !== undefined) body.correctAnswer = correctAnswer;
  if (authored.correctness.kind === "set") body.answers = authored.correctness.answers;
  const variant: ItemVariant = {
    id: `${authored.id}@1.0.0`,
    itemId: authored.id,
    version: "1.0.0",
    status: "active",
    cohortWeight: 1,
    publishedAt: new Date().toISOString(),
    body,
    defectCount: 0,
    ...(ROUTABLE_SURFACE_TYPES.has(authored.surfaceType as never)
      ? { surfaceType: authored.surfaceType as ItemVariant["surfaceType"] }
      : {}),
  };
  return {
    id: authored.id,
    skillId: authored.skillIds[0],
    authoringMeta: {
      source: "item-bank:import",
      gradeBand: authored.gradeBand,
      locale: authored.locale,
      ...(authored.meta ?? {}),
    },
    variants: [variant],
  };
}

const FILE_HEADER = `/**
 * Imported production items — the durable store behind \`item-bank:import\`.
 *
 * Remediation Sprint 05: the import CLI used to validate authored items and
 * then throw them away (NULL persist adapter). It now converts each
 * \`AuthoredItem\` to a runtime \`Item\` and REWRITES THIS FILE, so imported
 * items become part of the production banks (\`getProductionItemsForSubject\`)
 * and the coverage gate counts them like any seed item.
 *
 * ⚠️ AUTO-MANAGED by \`pnpm item-bank:import\` (see cli/file-persist.ts).
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
export const IMPORTED_PRODUCTION_ITEMS: ReadonlyArray<ImportedProductionItem> =`;

function renderModule(entries: ReadonlyArray<{ subject: string; item: Item }>): string {
  const payload =
    entries.length === 0 ? "[];" : `${JSON.stringify(entries, null, 2)} as const;`;
  return `${FILE_HEADER} ${payload}\n`;
}

/** Default on-disk location of the generated module (package src). */
export function defaultImportedItemsPath(): string {
  return path.resolve(fileURLToPath(import.meta.url), "../../../src/imported-items.ts");
}

/**
 * Create the file-backed persist adapter. `modulePath` points at the
 * generated TS module (defaults to the package's `src/imported-items.ts`);
 * tests pass a temp path.
 */
export function createFileBankPersistAdapter(modulePath?: string): PersistAdapter & {
  flush(): Promise<void>;
} {
  const target = modulePath ?? defaultImportedItemsPath();
  let loaded: Array<{ subject: string; item: Item }> | null = null;

  async function load(): Promise<Array<{ subject: string; item: Item }>> {
    if (loaded) return loaded;
    try {
      const mod = (await import(`${pathToFileURL(target).href}?t=${Date.now()}`)) as {
        IMPORTED_PRODUCTION_ITEMS?: ReadonlyArray<{ subject: string; item: Item }>;
      };
      loaded = [...(mod.IMPORTED_PRODUCTION_ITEMS ?? [])];
    } catch {
      loaded = [];
    }
    return loaded;
  }

  return {
    async upsertItem(authored, _bankId) {
      const entries = await load();
      const subject = BRAND_SLUG_TO_BANK_SUBJECT[authored.subjectSlug];
      if (!subject) {
        throw new Error(
          `item-bank:import — unknown subjectSlug "${authored.subjectSlug}" ` +
            `(no RequiredSubjectSlug mapping); add it to BRAND_SLUG_TO_BANK_SUBJECT.`,
        );
      }
      const item = authoredToRuntimeItem(authored);
      const existing = entries.findIndex((e) => e.item.id === item.id);
      if (existing >= 0) entries[existing] = { subject, item };
      else entries.push({ subject, item });
      await fs.writeFile(target, renderModule(entries), "utf8");
      return item.id;
    },
    async flush() {
      // Writes happen per-upsert (idempotent file rewrites); nothing buffered.
    },
  };
}
