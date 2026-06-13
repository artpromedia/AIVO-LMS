/**
 * Sprint C-14 — the never-told transparency narrative, made tellable.
 *
 * The per-decision `source` attribution and `confidenceSignals` have lived in
 * the brain profile since Sprint 4/7 (`lib/learner/brain-profile.ts`) but were
 * never surfaced on screen. This module turns those raw fields into the
 * storyboard's screen-3 "how she learns best" cards: each operating
 * instruction carries a SOURCE CHIP ("You told us" / "Her baseline showed" /
 * "Ms. Rivera observed") and a 3-LEVEL CONFIDENCE DOT.
 *
 * The confidence derivation is a PURE FUNCTION with documented thresholds so
 * the rule the parent sees ("we're fairly sure" / "early signal") is testable
 * and never drifts from the dots actually rendered.
 *
 * NON-NEGOTIABLE (report DoD #2): a chip or a dot never renders without
 * backing data. The derivation returns `null` when there is no real source —
 * the screen must skip the card entirely rather than invent a source.
 */

/**
 * Where an operating-instruction insight came from. Mirrors the prefixes used
 * by `lib/learner/brain-profile.ts` (`"collaborator:therapist"`) and the
 * confidence signals (parent assessment, baseline). The screen maps each kind
 * to plain parent language via i18n; this enum is the wire shape, never copy.
 */
export type RevealSourceKind =
  | "parent" // the parent told us (parent assessment)
  | "baseline" // her baseline adventure demonstrated it
  | "collaborator" // a teacher / therapist / caregiver observed it
  | "iep"; // carried over from the uploaded IEP

/** A single attribution behind one operating instruction. */
export type RevealSource = {
  kind: RevealSourceKind;
  /** For `collaborator`, the role ("teacher" | "therapist" | "caregiver");
   *  null for the non-collaborator kinds. Drives "Ms. Rivera observed" vs the
   *  generic role label. */
  role: string | null;
};

/** The three confidence levels shown as dots + plain words. */
export type RevealConfidence = "high" | "medium" | "low";

/**
 * Inputs to the confidence derivation. Deliberately small + already-normalised
 * so the rule is obvious and the unit tests pin every branch.
 */
export type ConfidenceInput = {
  /** Distinct, independent sources that AGREE on this instruction. Two entries
   *  with the same `kind` (e.g. two collaborators) still count as two
   *  independent voices; a parent + baseline is the canonical "≥2 agree". */
  sources: RevealSource[];
  /** Number of baseline questions answered (0 when no baseline yet). Lets a
   *  single strong baseline signal reach "high" on its own. */
  baselineAnswered: number;
};

/**
 * The baseline-answered count at/above which a single baseline signal is
 * trusted as "high" on its own. Twelve answered items is roughly half a
 * full baseline — enough demonstrated behaviour to stand alone. Documented
 * here (and shown to the parent in plain words via i18n) so the threshold is
 * never a magic number buried in a component.
 */
export const BASELINE_HIGH_CONFIDENCE_MIN = 12;

/**
 * The confidence rule (report §4.2 screen 3), as a pure function:
 *
 *   high   — ≥2 INDEPENDENT sources agree, OR a baseline signal with
 *            n ≥ BASELINE_HIGH_CONFIDENCE_MIN answered.
 *   medium — a single source that has baseline support behind it (the source
 *            set includes a baseline OR there is any baseline data alongside a
 *            single non-baseline source).
 *   low    — a single source with no baseline support ("early signal").
 *
 * Returns `null` when there is NO source at all — the caller must not render a
 * chip or a dot for an instruction with no backing data.
 */
export function deriveConfidence(input: ConfidenceInput): RevealConfidence | null {
  const sources = dedupeSources(input.sources);
  if (sources.length === 0) return null;

  const hasBaselineSource = sources.some((s) => s.kind === "baseline");
  const strongBaseline =
    hasBaselineSource && input.baselineAnswered >= BASELINE_HIGH_CONFIDENCE_MIN;

  // ≥2 independent voices that agree, or one strong baseline → high.
  if (sources.length >= 2 || strongBaseline) return "high";

  // Single source. Baseline support (either the source itself is the baseline,
  // or there is baseline data backing a single parent/collaborator claim) → medium.
  const hasBaselineSupport = hasBaselineSource || input.baselineAnswered > 0;
  return hasBaselineSupport ? "medium" : "low";
}

/**
 * Two sources are "the same voice" when they share a kind AND (for
 * collaborators) a role. A parent who said something twice is still one voice;
 * a teacher and a therapist are two. Keeps the ≥2-agree rule honest.
 */
function dedupeSources(sources: RevealSource[]): RevealSource[] {
  const seen = new Set<string>();
  const out: RevealSource[] = [];
  for (const s of sources) {
    const key = s.kind === "collaborator" ? `collaborator:${s.role ?? ""}` : s.kind;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

/**
 * Parse a raw `source` string from the brain profile's detailed decision
 * arrays (e.g. `"collaborator:therapist"`, `"functioning_level_template"`,
 * `"parent_modification"`) into a structured `RevealSource`, or `null` when
 * the string is a system/template origin that is NOT a parent-tellable voice.
 *
 * Only the origins a parent can recognise become chips: their own input, the
 * baseline, a named collaborator, the IEP. Template/functioning-level defaults
 * are real provenance but not a "voice", so they yield `null` and the caller
 * falls back to whatever first-party signal it has (or skips the chip).
 */
export function parseDecisionSource(raw: string | null | undefined): RevealSource | null {
  if (!raw) return null;
  const value = raw.trim().toLowerCase();
  if (value.length === 0) return null;

  if (value.startsWith("collaborator:")) {
    const role = value.slice("collaborator:".length).trim() || null;
    return { kind: "collaborator", role };
  }
  // brain-svc / discovery-adventure baseline provenance.
  if (value === "discovery_adventure" || value === "baseline" || value.startsWith("baseline")) {
    return { kind: "baseline", role: null };
  }
  if (value === "iep" || value.startsWith("iep")) {
    return { kind: "iep", role: null };
  }
  // A parent override is the parent's own voice.
  if (value === "parent_modification" || value.startsWith("parent")) {
    return { kind: "parent", role: null };
  }
  // Template / functioning-level defaults are provenance, not a parent voice.
  return null;
}
