import type { ItemVariant } from "./types.js";

export type ItemVariantIssueCode =
  | "missing_id"
  | "missing_item_id"
  | "invalid_version"
  | "invalid_cohort_weight"
  | "missing_published_at"
  | "empty_body"
  | "missing_captions_asset_for_media_surface";

export interface ItemVariantIssue {
  code: ItemVariantIssueCode;
  detail: string;
}

const SEMVER = /^\d+\.\d+\.\d+$/;

export function validateItemVariant(v: ItemVariant): ItemVariantIssue[] {
  const issues: ItemVariantIssue[] = [];
  if (!v.id) issues.push({ code: "missing_id", detail: "id is required." });
  if (!v.itemId) issues.push({ code: "missing_item_id", detail: "itemId is required." });
  if (!v.version || !SEMVER.test(v.version)) {
    issues.push({
      code: "invalid_version",
      detail: `version must be semver (X.Y.Z), got "${v.version}".`,
    });
  }
  if (typeof v.cohortWeight !== "number" || v.cohortWeight < 0 || v.cohortWeight > 1) {
    issues.push({
      code: "invalid_cohort_weight",
      detail: `cohortWeight must be in [0,1], got ${v.cohortWeight}.`,
    });
  }
  if (!v.publishedAt) {
    issues.push({ code: "missing_published_at", detail: "publishedAt is required (ISO-8601)." });
  }
  if (!v.body || Object.keys(v.body).length === 0) {
    issues.push({ code: "empty_body", detail: "body must contain the item content." });
  }
  if (v.surfaceType === "video" || v.surfaceType === "audio") {
    const hasCaptions = (v.assets ?? []).some((asset) => asset.type === "captions");
    if (!hasCaptions) {
      issues.push({
        code: "missing_captions_asset_for_media_surface",
        detail: `${v.surfaceType} variants must include at least one captions asset.`,
      });
    }
  }
  return issues;
}
