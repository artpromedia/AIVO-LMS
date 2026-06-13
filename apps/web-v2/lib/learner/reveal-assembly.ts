/**
 * Sprint C-14 — server-side assembly for the stitched reveal (screens 1, 3, 4)
 * and the strengths-only share artifact (screen 7).
 *
 * Pure + deterministic (no DB, no React): the page server component fetches the
 * brain profile, parent assessment, baseline summary, and collaborator insights
 * and hands them here; this module turns them into the exact view-models the
 * reveal screens render. Keeping it pure makes the contribution counts, the
 * source-chip backing, and — most importantly — the share artifact's allowed
 * field surface unit-testable without a runtime.
 *
 * Source-attribution discipline (report §4.1 point 2 / DoD #2): every operating
 * instruction on screen 3 traces to a real `source` field or a real
 * `confidenceSignal`. A card with no backing source is dropped, never invented.
 */
import type { CollaboratorInsight, LearnerBrainProfileState } from "@/lib/db/types";
import {
  deriveConfidence,
  parseDecisionSource,
  type RevealConfidence,
  type RevealSource,
} from "./reveal-confidence";

// ─────────────────────────────────────────────────────────────────────────
// Screen 1 — inputs assembling (one card per source, real contribution counts)
// ─────────────────────────────────────────────────────────────────────────

/** The kind of input source, driving the card's icon + i18n title. */
export type ContributionSourceKind = "parent" | "baseline" | "collaborator" | "iep";

/**
 * One source card on screen 1. `count`/`unit` are the real contribution
 * numbers ("11 sections", "23 questions", "2 observations"); `role` names the
 * collaborator. Copy lives in i18n — the card carries only the data.
 */
export type ContributionCard = {
  key: string;
  kind: ContributionSourceKind;
  /** Primary count (sections answered, questions answered, insight count). 0 is
   *  valid only for the IEP card (presence, not a count). */
  count: number;
  /** Collaborator role for the `collaborator` kind; null otherwise. */
  role: string | null;
  /** True for the IEP card, which is presence-not-count. */
  presenceOnly?: boolean;
};

export type ContributionSummary = {
  cards: ContributionCard[];
  /** True when no source contributed anything — drives screen 1's honest
   *  zero-contributor empty state (still a designed state, never a blank). */
  isEmpty: boolean;
};

export type AssembleContributionsInput = {
  /** Completed parent-assessment sections (ParentAssessment.completedSections). */
  parentCompletedSections: number;
  /** Whether the parent assessment was submitted (confidenceSignals.parentAssessment). */
  parentSubmitted: boolean;
  /** Baseline questions answered (BaselineSummary.totalAnswered); 0 when none. */
  baselineAnswered: number;
  /** Accepted collaborator insights (folded into the profile pre-build). */
  collaboratorInsights: Pick<CollaboratorInsight, "authorRole">[];
  /** Whether an IEP is on file (confidenceSignals.iep / iepProfile.uploaded). */
  iepOnFile: boolean;
};

/**
 * Build screen 1's source cards from real contribution counts. A source only
 * gets a card when it actually contributed (sections > 0, baseline answered > 0,
 * ≥1 insight, IEP present) — the empty/partial variants fall out naturally.
 */
export function assembleContributions(input: AssembleContributionsInput): ContributionSummary {
  const cards: ContributionCard[] = [];

  // Parent assessment — counted by completed sections (the parent's effort).
  if (input.parentCompletedSections > 0 || input.parentSubmitted) {
    cards.push({
      key: "parent",
      kind: "parent",
      count: input.parentCompletedSections,
      role: null,
    });
  }

  // Baseline adventure — counted by questions answered.
  if (input.baselineAnswered > 0) {
    cards.push({
      key: "baseline",
      kind: "baseline",
      count: input.baselineAnswered,
      role: null,
    });
  }

  // Collaborators — one card per role, counting that role's insights. A
  // therapist with 2 insights + a teacher with 1 ⇒ two cards (2, 1).
  const byRole = new Map<string, number>();
  for (const insight of input.collaboratorInsights) {
    const role = (insight.authorRole ?? "").trim().toLowerCase();
    if (!role) continue;
    byRole.set(role, (byRole.get(role) ?? 0) + 1);
  }
  for (const [role, count] of [...byRole.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    cards.push({ key: `collaborator:${role}`, kind: "collaborator", count, role });
  }

  // IEP — presence, not a count.
  if (input.iepOnFile) {
    cards.push({ key: "iep", kind: "iep", count: 0, role: null, presenceOnly: true });
  }

  return { cards, isEmpty: cards.length === 0 };
}

// ─────────────────────────────────────────────────────────────────────────
// Screen 3 — how she learns best (operating instructions w/ source + confidence)
// ─────────────────────────────────────────────────────────────────────────

/** The four operating-instruction facets the screen renders as cards. */
export type OperatingFacet = "modality" | "pacing" | "sensory" | "focus";

/**
 * One operating-instruction card. `valueKey`/`valueArg` resolve to the plain
 * instruction copy ("Show it, then let her try"); `source` + `confidence` back
 * the chip + dot. Both are guaranteed non-null here — a card with no backing
 * source is never produced (see `assembleOperatingInstructions`).
 */
export type OperatingInstruction = {
  facet: OperatingFacet;
  /** i18n value sub-key under the facet (e.g. "visual", "fast", "calm"). */
  valueKey: string;
  /** The primary source behind the instruction (drives the chip). */
  source: RevealSource;
  /** Confidence from the pure derivation (drives the 3-level dot). */
  confidence: RevealConfidence;
};

export type AssembleOperatingInput = {
  state: LearnerBrainProfileState;
  baselineAnswered: number;
};

/**
 * Derive the operating-instruction cards for screen 3 from the brain profile.
 *
 * For each facet we collect the real sources that speak to it:
 *   - The parent assessment (a first-party "you told us" signal) when the
 *     facet's underlying field was parent-derivable.
 *   - The baseline, when there is baseline data.
 *   - Any collaborator decision whose `source` field touches the facet.
 *
 * The card is emitted ONLY when at least one real source exists; the confidence
 * dot comes from `deriveConfidence`. No source ⇒ no card (DoD #2).
 */
export function assembleOperatingInstructions(
  input: AssembleOperatingInput,
): OperatingInstruction[] {
  const { state, baselineAnswered } = input;
  const out: OperatingInstruction[] = [];

  const parentSpoke = Boolean(state.confidenceSignals.parentAssessment);
  const hasBaseline = baselineAnswered > 0;

  // Collaborator sources by the domain their insight touched, parsed from the
  // detailed accommodation/tutor decision `source` fields.
  const collaboratorSources = collectCollaboratorSources(state);

  // ── modality (how she takes information in) ──
  const modality = state.preferredModalities[0];
  if (modality) {
    const sources: RevealSource[] = [];
    // Modality is inferred from the parent's communication-style answer.
    if (parentSpoke) sources.push({ kind: "parent", role: null });
    if (hasBaseline) sources.push({ kind: "baseline", role: null });
    pushIf(out, "modality", modality, sources, baselineAnswered);
  }

  // ── pacing (how fast to move) ──
  // tutorPersonaRecommendation.style encodes pace; it is parent-assessment-derived.
  const pacing = paceKeyForPersona(state.tutorPersonaRecommendation.style);
  if (pacing) {
    const sources: RevealSource[] = [];
    if (parentSpoke) sources.push({ kind: "parent", role: null });
    // A collaborator SEL/attention insight reinforces pacing (Harmony tutor).
    for (const cs of collaboratorSources.pacing) sources.push(cs);
    pushIf(out, "pacing", pacing, sources, baselineAnswered);
  }

  // ── sensory (environment to set up) ──
  const sensory = sensoryKey(state.sensoryProfile.seekingOrAvoiding, state.supportDefaults.sensoryBreaks);
  if (sensory) {
    const sources: RevealSource[] = [];
    if (parentSpoke && state.sensoryProfile.seekingOrAvoiding !== "unspecified") {
      sources.push({ kind: "parent", role: null });
    }
    for (const cs of collaboratorSources.sensory) sources.push(cs);
    pushIf(out, "sensory", sensory, sources, baselineAnswered);
  }

  // ── focus (how long, and how to break) ──
  const focus = focusKey(state.attentionProfile.breakStyle, state.attentionProfile.focusWindowMinutes);
  if (focus) {
    const sources: RevealSource[] = [];
    if (parentSpoke) sources.push({ kind: "parent", role: null });
    if (hasBaseline) sources.push({ kind: "baseline", role: null });
    for (const cs of collaboratorSources.focus) sources.push(cs);
    pushIf(out, "focus", focus, sources, baselineAnswered);
  }

  return out;
}

/** Append an instruction only when at least one real source backs it. */
function pushIf(
  out: OperatingInstruction[],
  facet: OperatingFacet,
  valueKey: string,
  sources: RevealSource[],
  baselineAnswered: number,
): void {
  const confidence = deriveConfidence({ sources, baselineAnswered });
  if (!confidence) return; // no backing data → no chip, no dot, no card.
  // The chip names the strongest single voice: a named collaborator first
  // (most specific), else the parent, else the baseline.
  const primary =
    sources.find((s) => s.kind === "collaborator") ??
    sources.find((s) => s.kind === "parent") ??
    sources[0]!;
  out.push({ facet, valueKey, source: primary, confidence });
}

type FacetCollaborators = {
  pacing: RevealSource[];
  sensory: RevealSource[];
  focus: RevealSource[];
};

/**
 * Parse the profile's detailed accommodation + tutor decisions for collaborator
 * `source` fields and bucket them by the facet their domain touches. This is
 * how "Ms. Rivera observed" reaches a sensory/focus card — the therapist's
 * sensory insight raised sensory_breaks with `source: "collaborator:therapist"`.
 */
function collectCollaboratorSources(state: LearnerBrainProfileState): FacetCollaborators {
  const buckets: FacetCollaborators = { pacing: [], sensory: [], focus: [] };
  const detailed = state.xaiExplanation.accommodationDecisionsDetailed ?? [];
  for (const d of detailed) {
    const src = parseDecisionSource(d.source);
    if (!src || src.kind !== "collaborator") continue;
    const acc = d.accommodation.toLowerCase();
    if (acc.includes("sensory")) buckets.sensory.push(src);
    else if (acc.includes("visual_schedule")) buckets.focus.push(src);
    // AAC / read-aloud / speech-to-text don't map onto these 4 facets.
  }
  // Tutor decisions: Harmony (SEL/attention) reinforces pacing + focus.
  const tutors = state.xaiExplanation.tutorDecisionsDetailed ?? [];
  for (const td of tutors) {
    const src = parseDecisionSource(td.source);
    if (!src || src.kind !== "collaborator") continue;
    if (td.tutorKey === "harmony") {
      buckets.pacing.push(src);
      buckets.focus.push(src);
    }
  }
  return buckets;
}

function paceKeyForPersona(
  style: LearnerBrainProfileState["tutorPersonaRecommendation"]["style"],
): string | null {
  switch (style) {
    case "structured_mentor":
      return "fast";
    case "warm_coach":
    case "calm_guide":
      return "gentle";
    case "playful_friend":
      return "steady";
    default:
      return null;
  }
}

function sensoryKey(
  seekingOrAvoiding: LearnerBrainProfileState["sensoryProfile"]["seekingOrAvoiding"],
  sensoryBreaks: boolean,
): string | null {
  if (seekingOrAvoiding === "avoiding") return "calm";
  if (seekingOrAvoiding === "seeking") return "active";
  if (sensoryBreaks) return "breaks";
  return null;
}

function focusKey(
  breakStyle: LearnerBrainProfileState["attentionProfile"]["breakStyle"],
  focusWindowMinutes: number,
): string | null {
  if (breakStyle === "frequent_short") return "short_bursts";
  if (breakStyle === "long_uninterrupted") return "deep_focus";
  if (focusWindowMinutes > 0 && focusWindowMinutes < 10) return "short_bursts";
  if (breakStyle === "occasional") return "steady_focus";
  return null;
}

// ─────────────────────────────────────────────────────────────────────────
// Screen 4 — where we'll start (qualitative growth framing; NO grade numbers)
// ─────────────────────────────────────────────────────────────────────────

/** One subject's starting point, framed as growth — never a grade-equivalent. */
export type StartingPoint = {
  subjectId: string;
  subjectName: string;
  /** Qualitative estimate (the only "level" parents ever see). */
  estimate: "new" | "growing" | "confident" | "advanced";
};

/**
 * Screen 4 reads the authoritative `masteryOverview` estimates straight
 * through. Decision D4(b): grade language would come ONLY from the
 * curriculum-svc catalogue (ADR 0040). That grounding is not wired into web-v2
 * (curriculum-svc is read-only and not called per-learner here), so per the
 * pre-decided fallback we ship qualitative growth framing only and never
 * fabricate a number. No `scoreToGradeEquiv`, no score×grade math.
 */
export function assembleStartingPoints(state: LearnerBrainProfileState): StartingPoint[] {
  return state.masteryOverview.map((m) => ({
    subjectId: m.subjectId,
    subjectName: m.subjectName,
    estimate: m.estimate,
  }));
}

// ─────────────────────────────────────────────────────────────────────────
// Screen 7 — the strengths-ONLY share artifact (safe by construction)
// ─────────────────────────────────────────────────────────────────────────

/**
 * The COMPLETE field surface of the share artifact. By construction it carries
 * only the child's first name, their strengths, and their interests — NO
 * levels, NO accommodations, NO diagnoses, NO source data. The content-safety
 * test asserts these are the only keys, so the type and the test together make
 * a privacy leak impossible to merge.
 */
export type ShareArtifactContent = {
  /** Child's FIRST name only (no surname, no display name with extras). */
  firstName: string;
  /** Strengths in the parent's / baseline's words. */
  strengths: string[];
  /** Interests ("what they love"). */
  interests: string[];
};

export type BuildShareArtifactInput = {
  /** The child's first name (already first-name-only at the call site). */
  firstName: string;
  /** "Good at" entries from the parent assessment. */
  goodAt: string[];
  /** Subjects where the baseline estimate is confident/advanced. */
  strongSubjects: string[];
  /** Free-text "what they love" (may be empty). */
  loves: string;
  /** Free-text "what motivates them" (may be empty). */
  motivates: string;
};

/** Max items kept on the card so it stays glanceable (a grandparent's eyes). */
const SHARE_MAX_STRENGTHS = 5;
const SHARE_MAX_INTERESTS = 3;

/**
 * Build the share artifact. Strengths = the parent's "good at" words plus
 * baseline-strong subjects (deduped, capped). Interests = "loves" + "motivates"
 * free text (split into short phrases, capped). Everything is trimmed and
 * de-duplicated; empties are dropped. The output type is the entire surface —
 * there is no field here that could leak a level, accommodation, or diagnosis.
 */
export function buildShareArtifact(input: BuildShareArtifactInput): ShareArtifactContent {
  const strengths = dedupeNonEmpty([...input.goodAt, ...input.strongSubjects]).slice(
    0,
    SHARE_MAX_STRENGTHS,
  );
  const interests = dedupeNonEmpty([
    ...splitPhrases(input.loves),
    ...splitPhrases(input.motivates),
  ]).slice(0, SHARE_MAX_INTERESTS);
  return {
    firstName: input.firstName.trim(),
    strengths,
    interests,
  };
}

/**
 * True when the artifact has enough to be worth sharing (a name + at least one
 * strength or interest). The screen falls back to a warm "still getting to
 * know {name}" state otherwise rather than rendering an empty card.
 */
export function shareArtifactHasContent(content: ShareArtifactContent): boolean {
  return content.strengths.length > 0 || content.interests.length > 0;
}

function dedupeNonEmpty(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const v = raw.trim().replace(/\s+/g, " ");
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

/** Split a free-text answer into short interest phrases (comma / "and" / ;). */
function splitPhrases(text: string): string[] {
  return text
    .split(/[,;]|\band\b/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.length <= 60);
}
