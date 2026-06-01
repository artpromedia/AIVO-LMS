/**
 * Curated AAC core-word vocabulary.
 *
 * Core words are the small set of high-frequency, topic-independent words that
 * make up the majority of everyday communication ("want", "more", "stop", "go",
 * …). Best practice is to anchor every AAC user's board in core vocabulary and
 * layer fringe (topic-specific) words on top — so a freshly provisioned learner
 * board is never empty.
 *
 * `symbolKey` is the stable identifier within the configured symbol set; the
 * image URL is resolved at board-build time via {@link resolveSymbolUrl} so the
 * symbol set / CDN can change without a data migration.
 */

export interface CoreWord {
  label: string;
  symbolKey: string;
  /** 0-based position in the canonical core grid. */
  row: number;
  col: number;
  /** Fitzgerald-key colour by part of speech (AAC convention). */
  backgroundColor: string;
}

/** Canonical core grid width. */
export const CORE_GRID_COLS = 4;

// Fitzgerald-key colours (a widely used AAC colour-coding convention).
const PRONOUN = "#FFD966"; // yellow
const VERB = "#9FC5E8"; // green-blue → action
const DESCRIB = "#B6D7A8"; // green → describing
const SOCIAL = "#EA9999"; // red/pink → social
const NEGATE = "#F6B26B"; // orange

/**
 * Default English core board (16 words, 4×4). Ordered for motor-planning
 * stability — positions are fixed so a learner builds muscle memory.
 */
const EN_CORE: CoreWord[] = [
  { label: "I", symbolKey: "i", row: 0, col: 0, backgroundColor: PRONOUN },
  { label: "you", symbolKey: "you", row: 0, col: 1, backgroundColor: PRONOUN },
  { label: "want", symbolKey: "want", row: 0, col: 2, backgroundColor: VERB },
  { label: "go", symbolKey: "go", row: 0, col: 3, backgroundColor: VERB },
  { label: "more", symbolKey: "more", row: 1, col: 0, backgroundColor: DESCRIB },
  { label: "stop", symbolKey: "stop", row: 1, col: 1, backgroundColor: NEGATE },
  { label: "help", symbolKey: "help", row: 1, col: 2, backgroundColor: VERB },
  { label: "like", symbolKey: "like", row: 1, col: 3, backgroundColor: VERB },
  { label: "yes", symbolKey: "yes", row: 2, col: 0, backgroundColor: SOCIAL },
  { label: "no", symbolKey: "no", row: 2, col: 1, backgroundColor: NEGATE },
  { label: "all done", symbolKey: "all_done", row: 2, col: 2, backgroundColor: DESCRIB },
  { label: "play", symbolKey: "play", row: 2, col: 3, backgroundColor: VERB },
  { label: "it", symbolKey: "it", row: 3, col: 0, backgroundColor: PRONOUN },
  { label: "that", symbolKey: "that", row: 3, col: 1, backgroundColor: PRONOUN },
  { label: "what", symbolKey: "what", row: 3, col: 2, backgroundColor: SOCIAL },
  { label: "feel", symbolKey: "feel", row: 3, col: 3, backgroundColor: VERB },
];

/**
 * Core-word sets keyed by locale (language subtag). Falls back to the base
 * language (e.g. "en-US" → "en") and finally to English.
 */
const CORE_BY_LOCALE: Record<string, CoreWord[]> = {
  en: EN_CORE,
};

/** Returns the curated core words for a locale (never empty). */
export function coreWordsForLocale(locale: string): CoreWord[] {
  if (CORE_BY_LOCALE[locale]) return CORE_BY_LOCALE[locale];
  const base = locale.split("-")[0];
  return CORE_BY_LOCALE[base] ?? EN_CORE;
}

/**
 * Resolve a symbol image URL from its key. `baseUrl` is the symbol CDN / asset
 * root (configure via the consuming service's env, e.g. AAC_SYMBOL_BASE_URL).
 */
export function resolveSymbolUrl(symbolKey: string, baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/$/, "");
  return `${trimmed}/${encodeURIComponent(symbolKey)}.svg`;
}
