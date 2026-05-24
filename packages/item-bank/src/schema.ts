/**
 * Sprint 2.2 — authoring schema for the `@aivo/item-bank`.
 *
 * Items are the smallest pedagogical units the assessment service
 * routes a learner through. Each item targets a specific subject /
 * grade band / set of skills and renders as a `surfaceType` (e.g.
 * `multiple_choice`, `short_response`, `geometry`, `coding_sandbox`).
 *
 * This schema is intentionally narrower than the runtime
 * `ItemVariant.body` blob in `./types.ts`: the authoring schema is what
 * subject-matter experts hand-write in YAML / JSON, the runtime schema
 * is what the assessment-svc persists after the import pipeline has
 * validated it. Importing a file via `pnpm item-bank:import` converts
 * `AuthoredItem` → `ItemVariant` and inserts both records.
 */
import { z } from "zod";

export const ITEM_BANK_SCHEMA_VERSION = 1;

export const ItemSurfaceType = z.enum([
  "multiple_choice",
  "short_response",
  "fill_in_blank",
  "drag_drop",
  "geometry",
  "math_expression",
  "coding_sandbox",
  "art_canvas",
  "voice_response",
  "ink_canvas",
  "scratchpad",
]);
export type ItemSurfaceType = z.infer<typeof ItemSurfaceType>;

export const GradeBand = z.enum([
  "PRE_K",
  "K",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
]);
export type GradeBand = z.infer<typeof GradeBand>;

export const ItemAsset = z.object({
  /** Stable identifier within the item. */
  id: z.string().min(1),
  kind: z.enum(["image", "audio", "video", "svg", "url"]),
  /** Relative path under the bank's asset root, or an https URL. */
  ref: z.string().min(1),
  /** Optional caption / alt-text override (the per-item accessibility
   *  block can also set altText for the *primary* image asset). */
  caption: z.string().optional(),
});
export type ItemAsset = z.infer<typeof ItemAsset>;

/**
 * Correctness rule. Authoring supports three flavours:
 *
 *   - `exact`: normalised string match against `answer`.
 *   - `set`: any of `answers[]`. Used for "say one synonym of X".
 *   - `rubric`: graded against `rubric.criteria[]` — the surface
 *     scorer returns a partial-credit score 0..1.
 */
export const Correctness = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("exact"), answer: z.string().min(1) }),
  z.object({ kind: z.literal("set"), answers: z.array(z.string().min(1)).min(1) }),
  z.object({
    kind: z.literal("rubric"),
    rubric: z.object({
      criteria: z
        .array(
          z.object({
            id: z.string().min(1),
            description: z.string().min(1),
            weight: z.number().min(0).max(1),
          }),
        )
        .min(1),
    }),
  }),
]);
export type Correctness = z.infer<typeof Correctness>;

export const IrtParams = z.object({
  a: z.number().describe("discrimination"),
  b: z.number().describe("difficulty"),
  c: z.number().min(0).max(1).optional().describe("guessing"),
});
export type IrtParams = z.infer<typeof IrtParams>;

export const Accessibility = z.object({
  /** Captions for any audio/video assets attached to the item. */
  captions: z.string().optional(),
  /** Alt-text for the primary image asset. */
  altText: z.string().optional(),
  /** Reading-level estimate (Flesch-Kincaid grade) of the stem +
   *  answer rationale. Surfaces consume this to gate ELL learners. */
  readingLevel: z.number().optional(),
  /** When true, the item depends on visual perception (e.g. a chart
   *  question) and is unsafe to deliver to a screen-reader-only
   *  learner without alt-text fallbacks. */
  visualDependent: z.boolean().optional(),
});
export type Accessibility = z.infer<typeof Accessibility>;

export const AuthoredItem = z.object({
  /** Stable id, unique within the bank. Slug-style (`math.k.count-3`). */
  id: z.string().regex(/^[a-z0-9][a-z0-9._-]*$/i, "id must be slug-style"),
  /** Subject slug from `@aivo/brand`'s LEARNER_SUBJECTS. */
  subjectSlug: z.string().min(1),
  gradeBand: GradeBand,
  /** Skill graph ids this item assesses. At least one. */
  skillIds: z.array(z.string().min(1)).min(1),
  surfaceType: ItemSurfaceType,
  stem: z.string().min(1),
  assets: z.array(ItemAsset).default([]),
  correctness: Correctness,
  irtParams: IrtParams.optional(),
  accessibility: Accessibility.default({}),
  /** BCP-47 language tag (e.g. "en", "es", "es-MX"). */
  locale: z.string().min(2).default("en"),
  /** Free-form metadata — author email, source standard, tags. Optional. */
  meta: z.record(z.string()).optional(),
});
export type AuthoredItem = z.infer<typeof AuthoredItem>;

export const AuthoredItemBank = z.object({
  schemaVersion: z.literal(ITEM_BANK_SCHEMA_VERSION),
  /** Stable id (`"k-math-fall-2026"`). */
  id: z.string().min(1),
  items: z.array(AuthoredItem),
});
export type AuthoredItemBank = z.infer<typeof AuthoredItemBank>;

/** Coverage row: how many items target each (subject × gradeBand × skill). */
export interface CoverageRow {
  subjectSlug: string;
  gradeBand: GradeBand | string;
  skillId: string;
  itemCount: number;
}

export interface CoverageReport {
  totalItems: number;
  bySubject: Record<string, number>;
  byGradeBand: Record<string, number>;
  bySkill: Record<string, number>;
  rows: CoverageRow[];
  /** Skill ids referenced by an item with no items at all (after a partial import). */
  uncoveredSkillIds: string[];
}

export function buildCoverageReport(
  items: AuthoredItem[],
  knownSkillIds: string[] = [],
): CoverageReport {
  const bySubject: Record<string, number> = {};
  const byGradeBand: Record<string, number> = {};
  const bySkill: Record<string, number> = {};
  const rowKey = new Map<string, CoverageRow>();
  for (const item of items) {
    bySubject[item.subjectSlug] = (bySubject[item.subjectSlug] ?? 0) + 1;
    byGradeBand[item.gradeBand] = (byGradeBand[item.gradeBand] ?? 0) + 1;
    for (const sid of item.skillIds) {
      bySkill[sid] = (bySkill[sid] ?? 0) + 1;
      const key = `${item.subjectSlug}|${item.gradeBand}|${sid}`;
      const existing = rowKey.get(key);
      if (existing) {
        existing.itemCount += 1;
      } else {
        rowKey.set(key, {
          subjectSlug: item.subjectSlug,
          gradeBand: item.gradeBand,
          skillId: sid,
          itemCount: 1,
        });
      }
    }
  }
  const covered = new Set(Object.keys(bySkill));
  const uncoveredSkillIds = knownSkillIds.filter((id) => !covered.has(id));
  return {
    totalItems: items.length,
    bySubject,
    byGradeBand,
    bySkill,
    rows: Array.from(rowKey.values()).sort((a, b) =>
      `${a.subjectSlug}|${a.gradeBand}|${a.skillId}`.localeCompare(
        `${b.subjectSlug}|${b.gradeBand}|${b.skillId}`,
      ),
    ),
    uncoveredSkillIds,
  };
}
