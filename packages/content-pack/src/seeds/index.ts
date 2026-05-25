/**
 * Authored content-pack seeds (Sprint E — completion plan).
 *
 * Each export is a fully validated ContentPack that the tutor-runtime
 * can load as a cold-start scaffold for a (subject, gradeBand) slice.
 * The seeds are intentionally compact (~5 activities each) — the
 * authoring CMS will overlay deeper packs as content is produced.
 *
 * Every seed is exercised by packages/content-pack/__tests__/seeds.test.ts
 * to keep this list and `validateContentPack` in lockstep.
 */
import type { ContentPack } from "../types.js";

import { mathKFall2026 } from "./math-k-fall-2026.js";
import { elaKFall2026 } from "./ela-k-fall-2026.js";
import { scienceKFall2026 } from "./science-k-fall-2026.js";
import { codingK2Fall2026 } from "./coding-k2-fall-2026.js";

export { mathKFall2026, elaKFall2026, scienceKFall2026, codingK2Fall2026 };

/** Every seeded pack, keyed by pack id. Used by the validator script
 * and by tutor-runtime cold-start loaders. */
export const SEEDED_PACKS: Readonly<Record<string, ContentPack>> = {
  [mathKFall2026.id]: mathKFall2026,
  [elaKFall2026.id]: elaKFall2026,
  [scienceKFall2026.id]: scienceKFall2026,
  [codingK2Fall2026.id]: codingK2Fall2026,
};

export function getSeededPack(id: string): ContentPack | undefined {
  return SEEDED_PACKS[id];
}
