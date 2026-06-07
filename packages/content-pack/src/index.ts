/**
 * `@aivo/content-pack` — schema + validator for the AIVO content-pack
 * authoring/CMS pipeline.
 *
 * Future versions will add: pack signing, CDN bundle layout, and a CLI
 * (`aivo-pack lint`) for the (planned) admin CMS.
 */
export type {
  Asset,
  Activity,
  ActivityType,
  AdaptationProfile,
  ContentPack,
  ContentPackIssue,
  ContentPackIssueCode,
  DifficultyLevel,
  GradeBand,
  Subject,
} from "./types.js";

export { validateContentPack, isContentPackValid } from "./validate.js";

export {
  SEEDED_PACKS,
  getSeededPack,
  mathKFall2026,
  elaKFall2026,
  scienceKFall2026,
  codingK2Fall2026,
  AUTHORED_SUBJECT_PACKS,
} from "./seeds/index.js";
