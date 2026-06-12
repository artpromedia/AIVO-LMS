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
import { writingKFall2026 } from "./writing-k-fall-2026.js";
import { selKFall2026 } from "./sel-k-fall-2026.js";
import { speechKFall2026 } from "./speech-k-fall-2026.js";
import { speech3Fall2026 } from "./speech-3-fall-2026.js";
import { speech6Fall2026 } from "./speech-6-fall-2026.js";
import { speech9Fall2026 } from "./speech-9-fall-2026.js";
import { geographyKFall2026 } from "./geography-k-fall-2026.js";
import { socialStudiesKFall2026 } from "./social-studies-k-fall-2026.js";
import { lifeSkillsKFall2026 } from "./life-skills-k-fall-2026.js";
import { executiveFunctionKFall2026 } from "./executive-function-k-fall-2026.js";
import { creativeArtsKFall2026 } from "./creative-arts-k-fall-2026.js";
import { musicKFall2026 } from "./music-k-fall-2026.js";
import { peHealthKFall2026 } from "./pe-health-k-fall-2026.js";
import { worldLanguagesKFall2026 } from "./world-languages-k-fall-2026.js";
import { stemEngineeringKFall2026 } from "./stem-engineering-k-fall-2026.js";
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
  [writingKFall2026.id]: writingKFall2026,
  [selKFall2026.id]: selKFall2026,
  [speechKFall2026.id]: speechKFall2026,
  [speech3Fall2026.id]: speech3Fall2026,
  [speech6Fall2026.id]: speech6Fall2026,
  [speech9Fall2026.id]: speech9Fall2026,
  [geographyKFall2026.id]: geographyKFall2026,
  [socialStudiesKFall2026.id]: socialStudiesKFall2026,
  [lifeSkillsKFall2026.id]: lifeSkillsKFall2026,
  [executiveFunctionKFall2026.id]: executiveFunctionKFall2026,
  [creativeArtsKFall2026.id]: creativeArtsKFall2026,
  [musicKFall2026.id]: musicKFall2026,
  [peHealthKFall2026.id]: peHealthKFall2026,
  [worldLanguagesKFall2026.id]: worldLanguagesKFall2026,
  [stemEngineeringKFall2026.id]: stemEngineeringKFall2026,
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
  "writing-k-fall-2026",
  "sel-k-fall-2026",
  "speech-k-fall-2026",
  "speech-3-fall-2026",
  "speech-6-fall-2026",
  "speech-9-fall-2026",
  "geography-k-fall-2026",
  "social-studies-k-fall-2026",
  "life-skills-k-fall-2026",
  "executive-function-k-fall-2026",
  "creative-arts-k-fall-2026",
  "music-k-fall-2026",
  "pe-health-k-fall-2026",
  "world-languages-k-fall-2026",
  "stem-engineering-k-fall-2026",
];

export function isRealAuthoredPack(packId: string): boolean {
  return REAL_AUTHORED_PACK_IDS.includes(packId);
}

export function getSeededPack(id: string): ContentPack | undefined {
  return SEEDED_PACKS[id];
}
