/**
 * AAC symbol-board construction.
 *
 * Builds a learner's {@link SymbolBoard} from the durable `aac_vocabulary`
 * table (Sprint 3 — production readiness), replacing the previous empty
 * placeholder board. Every board is anchored by curated core vocabulary: if a
 * learner has no rows yet, the core set for their locale is seeded so the very
 * first sync is meaningful rather than empty.
 */
import { and, eq } from "drizzle-orm";
import { aacVocabulary } from "@aivo/db";
import {
  coreWordsForLocale,
  resolveSymbolUrl,
  CORE_GRID_COLS,
  type SymbolBoard,
  type SymbolItem,
} from "@aivo/aac-bridge";

/** Symbol image CDN / asset root used to resolve symbol_key → image URL. */
function symbolBaseUrl(): string {
  return process.env.AAC_SYMBOL_BASE_URL || "/aac-symbols";
}

/**
 * Ensure the learner has at least the curated core vocabulary for `locale`.
 * Idempotent: the unique (learner, locale, symbol_key) index makes a repeat
 * call a no-op via onConflictDoNothing. Returns the number of rows inserted.
 */
export async function ensureCoreVocabulary(
  db: any,
  learnerId: string,
  locale: string,
): Promise<number> {
  const core = coreWordsForLocale(locale);
  const rows = core.map((w) => ({
    learnerId,
    locale,
    label: w.label,
    symbolKey: w.symbolKey,
    kind: "core" as const,
    gridRow: w.row,
    gridCol: w.col,
    backgroundColor: w.backgroundColor,
  }));
  const inserted = await db
    .insert(aacVocabulary)
    .values(rows)
    .onConflictDoNothing({
      target: [aacVocabulary.learnerId, aacVocabulary.locale, aacVocabulary.symbolKey],
    })
    .returning({ id: aacVocabulary.id });
  return inserted.length;
}

/**
 * Build the learner's symbol board for `locale` from `aac_vocabulary`. Seeds
 * core vocabulary first so the board is never empty. Throws when, even after
 * seeding, no vocabulary exists — callers must NOT sync an empty board.
 */
export async function buildSymbolBoard(
  db: any,
  learnerId: string,
  locale: string,
): Promise<SymbolBoard> {
  await ensureCoreVocabulary(db, learnerId, locale);

  const words = await db
    .select()
    .from(aacVocabulary)
    .where(and(eq(aacVocabulary.learnerId, learnerId), eq(aacVocabulary.locale, locale)));

  if (!words.length) {
    throw new Error(`No AAC vocabulary for learner ${learnerId} (locale ${locale})`);
  }

  const base = symbolBaseUrl();
  const boardId = `aivo-${learnerId}`;
  const items: SymbolItem[] = words.map((w: any) => ({
    id: w.symbolKey,
    label: w.label,
    imageUrl: resolveSymbolUrl(w.symbolKey, base),
    boardId,
    position: { row: w.gridRow, col: w.gridCol },
    backgroundColor: w.backgroundColor ?? undefined,
  }));

  const maxRow = Math.max(...items.map((i) => i.position.row));
  const maxCol = Math.max(...items.map((i) => i.position.col), CORE_GRID_COLS - 1);

  return {
    id: boardId,
    name: `AIVO - ${learnerId}`,
    locale,
    items,
    grid: { rows: maxRow + 1, cols: maxCol + 1 },
  };
}
