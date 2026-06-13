/**
 * Sprint C-13 — brain-profile change DETECTION.
 *
 * Pure functions, no persistence: given the profile state BEFORE and AFTER a
 * mutation (plus the resulting revision and the source of the change), classify
 * what changed and produce one plain-language, strengths-respecting summary.
 *
 * The classification is the policy the whole sprint turns on (report §4.2):
 *
 *   - STRUCTURAL — functioning level changed, an accommodation/support was
 *     added or removed, a tutor was activated/deactivated, or the IEP-derived
 *     profile shifted. These notify the parent and require acknowledgement of
 *     the delta (`requiresAck: true`), non-blocking.
 *   - MASTERY — only per-domain mastery levels moved. These flow freely
 *     (`requiresAck: false`): recorded for the timeline, never emailed, never a
 *     re-acknowledgement demand.
 *
 * A structural change ALWAYS wins over a mastery change when both happen at
 * once (the parent is told about the supports/level shift; the mastery move
 * rides along in the same record's summary). When nothing meaningful changed,
 * `detectBrainProfileChange` returns null and no record is written.
 *
 * The `summary` is generated server-side English (the same convention as the
 * brain-svc regression `hypothesis` and the XAI decision strings) — the
 * timeline's chrome is i18n'd, the dynamic per-change summary is not a catalog
 * string. It is deliberately plain-language and free of "system/version/template"
 * jargon, and frames mastery dips as movement, never as failure.
 */
import { changeRequiresAck } from "@aivo/db";
import { TUTORS, type TutorKey } from "@aivo/brand";
import type {
  BrainProfileChangeKind,
  BrainProfileChangeSource,
  LearnerBrainProfileState,
} from "@/lib/db/types";
import { SUPPORT_DEFAULT_BY_SLUG, type CoreSupportSlug } from "@/lib/db/brain-corrections";

/** The detected delta — what a change record is built from. */
export interface BrainProfileChangeDelta {
  kind: BrainProfileChangeKind;
  fields: string[];
  summary: string;
  /** True iff structural — derived through the shared contract, never set ad-hoc. */
  requiresAck: boolean;
}

/** Human label for a support/accommodation slug. */
const SUPPORT_LABEL: Record<string, string> = {
  extended_time: "Extended time",
  read_aloud: "Read-aloud",
  speech_to_text: "Speech-to-text",
  visual_schedules: "Visual schedules",
  sensory_breaks: "Sensory breaks",
  aac_communication_support: "AAC communication support",
};

/** Human label for the coarse functioning level (parent-facing, never the enum). */
const FUNCTIONING_LEVEL_LABEL: Record<LearnerBrainProfileState["functioningLevel"], string> = {
  STANDARD: "standard pace",
  SUPPORTED: "extra support",
  LOW_VERBAL: "low-verbal support",
  NON_VERBAL: "non-verbal support",
  PRE_SYMBOLIC: "pre-symbolic support",
};

function humanizeSlug(slug: string): string {
  return (
    SUPPORT_LABEL[slug] ??
    slug.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function tutorLabel(slug: string): string {
  return (
    TUTORS[slug as TutorKey]?.name ??
    slug.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

/** Is a support ON in the given state? Reads BOTH activeAccommodations and the
 *  matching supportDefaults flag (the lesson pipeline reads both). */
function supportOn(state: LearnerBrainProfileState, slug: string): boolean {
  if (state.activeAccommodations.includes(slug)) return true;
  if (slug in SUPPORT_DEFAULT_BY_SLUG) {
    return Boolean(state.supportDefaults[SUPPORT_DEFAULT_BY_SLUG[slug as CoreSupportSlug]]);
  }
  return false;
}

/** Every support slug worth diffing: the five core supports + any non-core
 *  accommodation present in either state. */
function allSupportSlugs(
  before: LearnerBrainProfileState,
  after: LearnerBrainProfileState,
): string[] {
  const slugs = new Set<string>(Object.keys(SUPPORT_DEFAULT_BY_SLUG));
  for (const a of before.activeAccommodations) slugs.add(a);
  for (const a of after.activeAccommodations) slugs.add(a);
  return [...slugs];
}

/** Round a mastery score to a coarse band so tiny float drift isn't a "change". */
function masteryBand(score: number): number {
  return Math.round(score * 20); // 5%-wide bands in [0..1]
}

/** Join a list of phrases into a natural-language clause ("A, B and C"). */
function naturalJoin(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** Phrase for the source, woven into the summary ("after a new baseline"). */
function sourcePhrase(source: BrainProfileChangeSource): string {
  switch (source) {
    case "baseline_reclone":
      return "after a fresh check-in";
    case "regenerate":
      return "after the profile was rebuilt from your latest answers";
    case "iep_update":
      return "after you shared an updated IEP";
    case "engagement_sync":
      return "from recent learning sessions";
    case "regression_detected":
      return "after a recent dip we spotted";
    case "amendment":
      return "from your note";
    case "rollback":
      return "after a profile was restored to an earlier version";
    default:
      return "";
  }
}

/**
 * Detect and classify the change between two profile states. Returns null when
 * nothing meaningful moved (no record is written). `learnerName` makes the
 * summary warm and specific.
 */
export function detectBrainProfileChange(input: {
  before: LearnerBrainProfileState;
  after: LearnerBrainProfileState;
  source: BrainProfileChangeSource;
  learnerName: string;
}): BrainProfileChangeDelta | null {
  const { before, after, source, learnerName } = input;
  const name = learnerName.trim() || "your learner";

  // ── Structural diffs ────────────────────────────────────────────────
  const structuralFields: string[] = [];
  const structuralPhrases: string[] = [];

  // Functioning level.
  if (before.functioningLevel !== after.functioningLevel) {
    structuralFields.push("functioningLevel");
    structuralPhrases.push(
      `${name}'s learning pace moved to ${FUNCTIONING_LEVEL_LABEL[after.functioningLevel]}`,
    );
  }

  // Supports / accommodations added or removed.
  const added: string[] = [];
  const removed: string[] = [];
  for (const slug of allSupportSlugs(before, after)) {
    const was = supportOn(before, slug);
    const now = supportOn(after, slug);
    if (was === now) continue;
    structuralFields.push(`accommodation.${slug}`);
    (now ? added : removed).push(humanizeSlug(slug));
  }
  if (added.length > 0) {
    structuralPhrases.push(`${naturalJoin(added)} ${added.length === 1 ? "is" : "are"} now on`);
  }
  if (removed.length > 0) {
    structuralPhrases.push(
      `${naturalJoin(removed)} ${removed.length === 1 ? "is" : "are"} no longer needed`,
    );
  }

  // Tutors activated / deactivated.
  const tutorsBefore = new Set(before.activeTutors);
  const tutorsAfter = new Set(after.activeTutors);
  const tutorsAdded: string[] = [];
  const tutorsRemoved: string[] = [];
  for (const t of tutorsAfter) if (!tutorsBefore.has(t)) tutorsAdded.push(tutorLabel(t));
  for (const t of tutorsBefore) if (!tutorsAfter.has(t)) tutorsRemoved.push(tutorLabel(t));
  for (const t of tutorsAfter) if (!tutorsBefore.has(t)) structuralFields.push(`tutor.${t}`);
  for (const t of tutorsBefore) if (!tutorsAfter.has(t)) structuralFields.push(`tutor.${t}`);
  if (tutorsAdded.length > 0) {
    structuralPhrases.push(
      `${naturalJoin(tutorsAdded)} joined ${name}'s learning team`,
    );
  }
  if (tutorsRemoved.length > 0) {
    structuralPhrases.push(`${naturalJoin(tutorsRemoved)} stepped back for now`);
  }

  // IEP-derived shift: categories or goal count changed.
  const iepBefore = before.iepProfile;
  const iepAfter = after.iepProfile;
  const iepCatsBefore = JSON.stringify((iepBefore?.categories ?? []).slice().sort());
  const iepCatsAfter = JSON.stringify((iepAfter?.categories ?? []).slice().sort());
  const iepGoalsBefore = iepBefore?.goals?.length ?? 0;
  const iepGoalsAfter = iepAfter?.goals?.length ?? 0;
  if (
    Boolean(iepBefore?.uploaded) !== Boolean(iepAfter?.uploaded) ||
    iepCatsBefore !== iepCatsAfter ||
    iepGoalsBefore !== iepGoalsAfter
  ) {
    structuralFields.push("iepProfile");
    structuralPhrases.push(`${name}'s IEP details were updated`);
  }

  // ── Mastery diffs (coarse-banded) ───────────────────────────────────
  const masteryFields: string[] = [];
  const masteryUps: string[] = [];
  const masteryDowns: string[] = [];
  const subjectName = new Map(after.masteryOverview.map((m) => [m.subjectId, m.subjectName]));
  const allDomains = new Set<string>([
    ...Object.keys(before.masteryLevels ?? {}),
    ...Object.keys(after.masteryLevels ?? {}),
  ]);
  for (const domain of allDomains) {
    const b = before.masteryLevels?.[domain];
    const a = after.masteryLevels?.[domain];
    if (typeof b !== "number" || typeof a !== "number") continue;
    if (masteryBand(b) === masteryBand(a)) continue;
    masteryFields.push(`masteryLevels.${domain}`);
    const label = subjectName.get(domain) ?? humanizeSlug(domain);
    (a > b ? masteryUps : masteryDowns).push(label);
  }

  const hasStructural = structuralFields.length > 0;
  const hasMastery = masteryFields.length > 0;
  if (!hasStructural && !hasMastery) return null;

  const where = sourcePhrase(source);

  if (hasStructural) {
    // Structural wins. Lead with the supports/level/team change; mention mastery
    // movement as a gentle aside if it rode along.
    const lead = structuralPhrases.length > 0
      ? structuralPhrases.join("; ")
      : `${name}'s profile changed`;
    let summary = where ? `${lead} ${where}.` : `${lead}.`;
    summary = summary.charAt(0).toUpperCase() + summary.slice(1);
    if (hasMastery) {
      const movers = [...masteryUps, ...masteryDowns];
      summary += ` We also saw movement in ${naturalJoin(movers)}.`;
    }
    return {
      kind: "structural",
      fields: [...structuralFields, ...masteryFields],
      summary,
      requiresAck: changeRequiresAck("structural"),
    };
  }

  // Mastery-only: flows freely, no ack, strengths-framed.
  let summary: string;
  if (masteryUps.length > 0 && masteryDowns.length === 0) {
    summary = `${name} is making progress in ${naturalJoin(masteryUps)}`;
  } else if (masteryUps.length > 0) {
    summary = `${name} grew in ${naturalJoin(masteryUps)}, and we're keeping a closer eye on ${naturalJoin(masteryDowns)}`;
  } else {
    summary = `We're keeping a closer eye on ${naturalJoin(masteryDowns)} to give ${name} the right practice`;
  }
  summary = where ? `${summary} ${where}.` : `${summary}.`;
  summary = summary.charAt(0).toUpperCase() + summary.slice(1);
  return {
    kind: "mastery",
    fields: masteryFields,
    summary,
    requiresAck: changeRequiresAck("mastery"),
  };
}
