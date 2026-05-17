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
