/**
 * Content-pack validator. Pure function, no I/O. Returns a list of issues;
 * an empty list means the pack is well-formed and safe to publish.
 *
 * The schema is enforced by the type system at the call site; this function
 * adds the *integrity* checks that TypeScript can't express:
 *   - no duplicate activity / asset ids
 *   - every assetRef resolves to a real asset
 *   - every image/video asset has alt text
 *   - multiple_choice activities have exactly one correct choice
 *   - voice activities have an expectedAnswer
 *   - required string fields are non-empty
 */
import type { Activity, Asset, ContentPack, ContentPackIssue } from "./types.js";

const REQUIRED_PACK_STRING_FIELDS: (keyof ContentPack)[] = [
  "id",
  "title",
  "version",
  "publishedAt",
  "license",
];

function nonEmpty(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function checkAsset(asset: Asset, issues: ContentPackIssue[]): void {
  if (!nonEmpty(asset.id)) {
    issues.push({ code: "missing_required_field", detail: "Asset is missing 'id'." });
  }
  if (!nonEmpty(asset.src)) {
    issues.push({
      code: "missing_required_field",
      refId: asset.id,
      detail: `Asset "${asset.id}" is missing 'src'.`,
    });
  }
  if ((asset.kind === "image" || asset.kind === "video") && !nonEmpty(asset.alt)) {
    issues.push({
      code: "missing_asset_alt",
      refId: asset.id,
      detail: `${asset.kind} asset "${asset.id}" is missing alt text (WCAG 1.1.1).`,
    });
  }
}

function checkActivity(
  activity: Activity,
  knownAssets: Map<string, Asset>,
  issues: ContentPackIssue[],
): void {
  if (!nonEmpty(activity.id)) {
    issues.push({ code: "missing_required_field", detail: "Activity is missing 'id'." });
  }
  if (!nonEmpty(activity.prompt)) {
    issues.push({
      code: "missing_required_field",
      refId: activity.id,
      detail: `Activity "${activity.id}" is missing 'prompt'.`,
    });
  }
  if (!nonEmpty(activity.skillId)) {
    issues.push({
      code: "missing_required_field",
      refId: activity.id,
      detail: `Activity "${activity.id}" is missing 'skillId'.`,
    });
  }

  for (const ref of activity.assetRefs ?? []) {
    if (!knownAssets.has(ref)) {
      issues.push({
        code: "unknown_asset_ref",
        refId: activity.id,
        detail: `Activity "${activity.id}" references unknown asset "${ref}".`,
      });
    }
  }

  // multiple_choice: exactly one `correct: true`
  if (activity.type === "multiple_choice") {
    const correctCount = (activity.choices ?? []).filter((c) => c.correct).length;
    if (correctCount === 0) {
      issues.push({
        code: "no_correct_choice",
        refId: activity.id,
        detail: `multiple_choice activity "${activity.id}" has no choice marked correct.`,
      });
    } else if (correctCount > 1) {
      issues.push({
        code: "multiple_correct_in_single_choice",
        refId: activity.id,
        detail: `multiple_choice activity "${activity.id}" has ${correctCount} correct choices; expected 1. Use type 'tap' for multi-select.`,
      });
    }
  }

  // voice: must have an expectedAnswer (or "" to opt into talking-practice)
  if (activity.type === "voice" && activity.expectedAnswer === undefined) {
    issues.push({
      code: "voice_missing_expected",
      refId: activity.id,
      detail: `voice activity "${activity.id}" must define expectedAnswer (use "" for free-form talking practice).`,
    });
  }

  if (activity.type === "video" || activity.type === "audio") {
    const hasCaptions = (activity.assetRefs ?? []).some(
      (ref) => knownAssets.get(ref)?.kind === "captions",
    );
    if (!hasCaptions) {
      issues.push({
        code: "missing_captions_asset",
        refId: activity.id,
        detail: `${activity.type} activity "${activity.id}" must reference at least one captions asset.`,
      });
    }
  }
}

export function validateContentPack(pack: ContentPack): ContentPackIssue[] {
  const issues: ContentPackIssue[] = [];

  if (pack.schemaVersion !== 1) {
    issues.push({
      code: "unsupported_schema_version",
      detail: `Pack schemaVersion=${String(pack.schemaVersion)}; this validator supports schemaVersion=1.`,
    });
  }

  for (const field of REQUIRED_PACK_STRING_FIELDS) {
    if (!nonEmpty(pack[field] as unknown)) {
      issues.push({
        code: "missing_required_field",
        detail: `Pack is missing '${String(field)}'.`,
      });
    }
  }

  if (!Array.isArray(pack.activities) || pack.activities.length === 0) {
    issues.push({
      code: "empty_pack",
      detail: `Pack "${pack.id}" has no activities.`,
    });
    // Continue — still surface other issues (e.g. asset duplicates).
  }

  // Asset integrity
  const assetsById = new Map<string, Asset>();
  for (const asset of pack.assets ?? []) {
    if (assetsById.has(asset.id)) {
      issues.push({
        code: "duplicate_asset_id",
        refId: asset.id,
        detail: `Asset id "${asset.id}" appears more than once.`,
      });
    }
    assetsById.set(asset.id, asset);
    checkAsset(asset, issues);
  }

  // Activity integrity
  const activityIds = new Set<string>();
  for (const activity of pack.activities ?? []) {
    if (activityIds.has(activity.id)) {
      issues.push({
        code: "duplicate_activity_id",
        refId: activity.id,
        detail: `Activity id "${activity.id}" appears more than once.`,
      });
    }
    activityIds.add(activity.id);
    checkActivity(activity, assetsById, issues);
  }

  return issues;
}

/** Convenience: returns true iff the pack has no validation issues. */
export function isContentPackValid(pack: ContentPack): boolean {
  return validateContentPack(pack).length === 0;
}
