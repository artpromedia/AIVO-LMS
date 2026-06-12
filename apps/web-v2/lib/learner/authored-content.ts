/**
 * Remediation Sprint 05 — authored content packs feed the learner lesson
 * path.
 *
 * Before this sprint web-v2 lessons consumed NEITHER `@aivo/content-pack`
 * nor `@aivo/item-bank`: the "authored" packs were dead at runtime and
 * authoring content changed nothing a learner saw. This module is the seam
 * that fixes it: `getAuthoredLessonItems` resolves the REAL authored packs
 * for a (subject, grade band) and maps their activities into guided-practice
 * items the generator serves first — the per-domain template builders
 * (domain-practice.ts) remain only as the deterministic fallback when no
 * authored content exists.
 *
 * Pack curation is explicit: `AUTHORED_LESSON_PACKS` lists the packs with
 * REAL authored activities. The `authoredPack()` template packs
 * (`packages/content-pack/src/seeds/authored-subject-catalog-2026.ts`) are
 * deliberately NOT served — they are the recognised 3-activity stubs the
 * production-readiness audit flagged (identical "Observe, explain, then
 * choose" choices for every subject); remediation Sprints 08-09 author real
 * packs and add them here.
 */
import {
  getSeededPack,
  isRealAuthoredPack,
  type Activity,
  type ContentPack,
} from "@aivo/content-pack";
import type { GeneratedLessonPlanInput } from "@/lib/validators/lesson";
import { buildVoiceResponseSurface, withSelectedSurface } from "./surface-selection";

type GuidedItem = GeneratedLessonPlanInput["guidedPractice"][number];

/**
 * The packs whose activities are REAL authored content (verified by hand,
 * not the template factory). Keyed by web-v2 learner-subject slug.
 */
export const AUTHORED_LESSON_PACKS: Readonly<Record<string, readonly string[]>> = {
  math: ["math-k-fall-2026", "math-1-fall-2026", "math-2-fall-2026"],
  reading: ["ela-k-fall-2026", "ela-1-fall-2026", "ela-2-fall-2026"],
  science: ["science-k-fall-2026"],
  coding: ["coding-k2-fall-2026", "coding-1-fall-2026", "coding-2-fall-2026"],
};

/** Expand a grade-band string ("K", "K-2", "PreK-K", "1-3", "3") into the
 *  set of single grades it covers. */
export function expandGradeBand(band: string | undefined | null): Set<string> {
  const out = new Set<string>();
  if (!band) return out;
  const normalized = band.trim().replace(/\s+/g, "");
  const gradeIndex = (token: string): number | null => {
    const t = token.toUpperCase();
    if (t === "PREK" || t === "PRE_K" || t === "PK") return -1;
    if (t === "K") return 0;
    const n = Number(t);
    return Number.isInteger(n) && n >= 1 && n <= 12 ? n : null;
  };
  const labelFor = (i: number): string => (i === -1 ? "PRE_K" : i === 0 ? "K" : String(i));
  const range = normalized.match(/^([A-Za-z_]+|\d+)-([A-Za-z_]+|\d+)$/);
  if (range) {
    const lo = gradeIndex(range[1]);
    const hi = gradeIndex(range[2]);
    if (lo !== null && hi !== null && hi >= lo) {
      for (let i = lo; i <= hi; i += 1) out.add(labelFor(i));
      return out;
    }
  }
  const single = gradeIndex(normalized);
  if (single !== null) out.add(labelFor(single));
  return out;
}

function bandsOverlap(a: string | undefined | null, b: string | undefined | null): boolean {
  const setA = expandGradeBand(a);
  const setB = expandGradeBand(b);
  for (const grade of setA) if (setB.has(grade)) return true;
  return false;
}

/** Supportive hint/scaffold derived from the activity's own metadata —
 *  the ContentPack Activity shape carries no hint/scaffold fields yet. */
function supportLines(activity: Activity): { hint: string; scaffold: string } {
  return {
    hint: `Think about: ${activity.title.toLowerCase()}.`,
    scaffold:
      activity.type === "voice"
        ? "Say it slowly — you can try as many times as you like."
        : "Take your time. Re-read the question, then pick the answer that fits best.",
  };
}

/** Map one authored Activity to a guided-practice item (or null when the
 *  activity type is not a guided interaction, e.g. narration). */
export function activityToGuidedItem(activity: Activity, subjectSlug: string): GuidedItem | null {
  const { hint, scaffold } = supportLines(activity);
  switch (activity.type) {
    case "multiple_choice":
    case "tap":
    case "match": {
      const labels = (activity.choices ?? []).map((c) => c.label);
      if (labels.length < 2) return null;
      const correct = (activity.choices ?? []).find((c) => c.correct)?.label;
      const item: GuidedItem = {
        prompt: activity.prompt,
        choices: labels,
        expectedAnswer: correct,
        hint,
        scaffold,
        skillId: "",
      };
      // Automatic surface derivation (e.g. numeric math choices → number
      // line) applies exactly as it does to template items.
      return withSelectedSurface(item, subjectSlug);
    }
    case "voice": {
      const target = (activity.expectedAnswer ?? "").split("|")[0]?.trim();
      if (!target) return null;
      return {
        prompt: activity.prompt,
        hint,
        scaffold,
        skillId: "",
        surface: buildVoiceResponseSurface({ language: "en-US", targetText: target }),
      };
    }
    case "drag_drop": {
      const choices = activity.choices ?? [];
      const targets = [...new Set(choices.map((c) => c.value).filter(Boolean))] as string[];
      if (choices.length === 0 || targets.length < 2) return null;
      return {
        prompt: activity.prompt,
        hint,
        scaffold,
        skillId: "",
        surface: {
          surfaceType: "drag_manipulative",
          dragManipulative: {
            items: choices.map((c) => ({ id: c.id, label: c.label })),
            targets: targets.map((t) => ({ id: t, label: t })),
            correctPlacement: Object.fromEntries(
              choices.filter((c) => c.value).map((c) => [c.id, c.value as string]),
            ),
          },
        },
      };
    }
    default:
      // narration / video / audio / draw — not a guided check; the lesson's
      // micro-lesson and media channels cover these.
      return null;
  }
}

const DIFFICULTY_ORDER: Record<Activity["difficulty"], number> = {
  intro: 0,
  core: 1,
  stretch: 2,
};

/**
 * The authored guided-practice items for a (subject slug, skill grade band),
 * intro→stretch ordered, capped at the plan schema's item budget. Empty when
 * no REAL authored pack covers the band — callers fall back to the domain
 * templates.
 */
export function getAuthoredLessonItems(input: {
  subjectSlug: string;
  gradeBand: string | undefined | null;
}): GuidedItem[] {
  const packIds = (AUTHORED_LESSON_PACKS[input.subjectSlug] ?? []).filter(isRealAuthoredPack);
  const items: Array<{ order: number; item: GuidedItem }> = [];
  for (const packId of packIds) {
    const pack: ContentPack | undefined = getSeededPack(packId);
    if (!pack) continue;
    if (!bandsOverlap(pack.gradeBand, input.gradeBand)) continue;
    for (const activity of pack.activities) {
      const item = activityToGuidedItem(activity, input.subjectSlug);
      if (item) items.push({ order: DIFFICULTY_ORDER[activity.difficulty], item });
    }
  }
  return items
    .sort((a, b) => a.order - b.order)
    .slice(0, 4)
    .map((entry) => entry.item);
}
