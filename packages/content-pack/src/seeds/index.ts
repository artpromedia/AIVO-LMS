/**
 * Authored content-pack seeds (Sprint E — completion plan).
 *
 * Each export is a fully validated ContentPack that the tutor-runtime
 * can load as a reviewed cold-start pack for a (subject, gradeBand) slice.
 * The authoring CMS can publish deeper packs while these remain a
 * production-safe offline and degraded-mode floor.
 *
 * Every seed is exercised by packages/content-pack/__tests__/seeds.test.ts
 * to keep this list and `validateContentPack` in lockstep.
 */
import type { ContentPack } from "../types.js";

import { mathKFall2026 } from "./math-k-fall-2026.js";
import { math1Fall2026 } from "./math-1-fall-2026.js";
import { math2Fall2026 } from "./math-2-fall-2026.js";
import { ela1Fall2026 } from "./ela-1-fall-2026.js";
import { ela2Fall2026 } from "./ela-2-fall-2026.js";
import { coding1Fall2026 } from "./coding-1-fall-2026.js";
import { coding2Fall2026 } from "./coding-2-fall-2026.js";
import { elaKFall2026 } from "./ela-k-fall-2026.js";
import { scienceKFall2026 } from "./science-k-fall-2026.js";
import { codingK2Fall2026 } from "./coding-k2-fall-2026.js";
import { AUTHORED_SUBJECT_PACKS } from "./authored-subject-catalog-2026.js";

export {
  mathKFall2026,
  elaKFall2026,
  scienceKFall2026,
  codingK2Fall2026,
  AUTHORED_SUBJECT_PACKS,
};

/** Every seeded pack, keyed by pack id. Used by the validator script
 * and by tutor-runtime cold-start loaders. */
export const SEEDED_PACKS: Readonly<Record<string, ContentPack>> = {
  [mathKFall2026.id]: mathKFall2026,
  [math1Fall2026.id]: math1Fall2026,
  [math2Fall2026.id]: math2Fall2026,
  [elaKFall2026.id]: elaKFall2026,
  [ela1Fall2026.id]: ela1Fall2026,
  [ela2Fall2026.id]: ela2Fall2026,
  [scienceKFall2026.id]: scienceKFall2026,
  [codingK2Fall2026.id]: codingK2Fall2026,
  [coding1Fall2026.id]: coding1Fall2026,
  [coding2Fall2026.id]: coding2Fall2026,
  ...Object.fromEntries(AUTHORED_SUBJECT_PACKS.map((pack) => [pack.id, pack])),
};

/**
 * Remediation Sprint 05 — the packs whose activities are REAL authored
 * content (verified by hand). The `authoredPack()` template packs in
 * authored-subject-catalog-2026.ts are deliberately excluded: they are the
 * recognised 3-activity stubs (identical "Observe, explain, then choose"
 * choices for every subject) the production-readiness audit flagged.
 * Consumers (web-v2 lesson generation, tutor-svc planSession) must only
 * serve packs from this list as authored content; Sprints 08-09 extend it
 * as real packs land.
 */
export const REAL_AUTHORED_PACK_IDS: readonly string[] = [
  "math-k-fall-2026",
  "math-1-fall-2026",
  "math-2-fall-2026",
  "ela-k-fall-2026",
  "ela-1-fall-2026",
  "ela-2-fall-2026",
  "science-k-fall-2026",
  "coding-k2-fall-2026",
  "coding-1-fall-2026",
  "coding-2-fall-2026",
];

export function isRealAuthoredPack(packId: string): boolean {
  return REAL_AUTHORED_PACK_IDS.includes(packId);
}

export function getSeededPack(id: string): ContentPack | undefined {
  return SEEDED_PACKS[id];
}
