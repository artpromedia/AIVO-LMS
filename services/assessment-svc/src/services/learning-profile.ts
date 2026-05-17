/**
 * Pure derivation of a `LearningProfile` from the existing Discovery
 * Adventure chapter results. The strategic advice is that the baseline
 * must emit a *learning profile* — modality fit, processing speed,
 * frustration tolerance, attention pattern — not just a grade-level
 * placement. This helper closes that gap without disrupting the
 * existing assessment flow: it consumes whatever the client already
 * sends to `discovery/complete` and writes a profile row.
 *
 * No DB / IO. The caller upserts the returned object into
 * `learner_profiles`.
 */

import {
  summariseSurfaceSignals,
  type SurfaceSignal,
  type SurfaceSignalSummary,
} from "./surface-signal-analysis.js";

export type Modality = "visual" | "auditory" | "kinesthetic" | "reading";

export interface ChapterResult {
  /** Subject domain — math, ela, science, speech, sel, executive_function. */
  domain: string;
  correct: number;
  total: number;
  difficulty?: string;
  avgLatencyMs?: number;
  /**
   * Optional fraction of items in the chapter where frustration /
   * disengagement signals fired (0…1). Defaults to 0 when absent.
   */
  frustrationRate?: number;
}

export interface DerivedProfile {
  thetaPlacement: number;
  modalityFit: Array<{ modality: Modality; accuracy: number; n: number }>;
  processingSpeedMs: number;
  frustrationRate: number;
  attentionRunLength: number;
  frustrationTolerance: "low" | "moderate" | "high";
  itemsAdministered: number;
  /**
   * Optional process-aware extension. Populated when the client sends
   * surface signals to `discovery/complete`. Existing callers that
   * pass only chapter results get `undefined` plus zeroed scalar
   * fields so the legacy persistence path keeps working.
   */
  surfaceSignalSummary?: SurfaceSignalSummary;
  inputModeFit: Array<{ mode: string; accuracy: number; n: number }>;
  scratchpadUseRate: number;
  hintDependenceRate: number;
  erasureRate: number;
  abandonmentRate: number;
  fineMotorDragConcern: boolean;
  selfCorrectionSignal: "low" | "moderate" | "high";
  preferredInteractionModes: string[];
  supportNeeds: string[];
}

/**
 * Each Discovery chapter has an intrinsic dominant delivery modality.
 * The mapping is intentionally simple: it is calibrated against how
 * each chapter is presented to the learner, not how the underlying
 * subject is taught in school.
 */
const DOMAIN_TO_MODALITY: Record<string, Modality> = {
  ela: "reading",
  math: "visual",
  science: "kinesthetic",
  sel: "auditory",
  speech: "auditory",
  executive_function: "visual",
  life_skills: "kinesthetic",
};

const MODALITY_ORDER: Modality[] = ["visual", "auditory", "kinesthetic", "reading"];

export function deriveLearningProfile(
  chapters: readonly ChapterResult[],
  /** Optional all-items response latencies, ms. */
  responseLatencies: readonly number[] = [],
  /** Optional per-activity surface signals from interactive surfaces. */
  surfaceSignals: readonly SurfaceSignal[] = [],
): DerivedProfile {
  const totalCorrect = chapters.reduce((s, c) => s + (c.correct || 0), 0);
  const totalItems = chapters.reduce((s, c) => s + (c.total || 0), 0);

  // ---- θ placement -----------------------------------------------------
  // Map [0,1] accuracy to a logit-like θ bounded to ±2.5.  Accuracy 0.5
  // → 0 ; 0.85 → +1.7 ; 0.15 → -1.7 .  This mirrors what a 1-PL fit
  // would yield for items at the average difficulty actually
  // administered.  An empty/no-data input returns θ=0 — we have no
  // signal to place the learner above or below average.
  let theta = 0;
  if (totalItems > 0) {
    const accuracy = totalCorrect / totalItems;
    const eps = 1e-3;
    const a = Math.min(1 - eps, Math.max(eps, accuracy));
    theta = Math.log(a / (1 - a));
    theta = Math.max(-2.5, Math.min(2.5, theta));
  }

  // ---- modality fit ----------------------------------------------------
  const buckets = new Map<Modality, { correct: number; n: number }>();
  for (const ch of chapters) {
    const modality = DOMAIN_TO_MODALITY[ch.domain] ?? "visual";
    const cur = buckets.get(modality) ?? { correct: 0, n: 0 };
    cur.correct += ch.correct || 0;
    cur.n += ch.total || 0;
    buckets.set(modality, cur);
  }
  const modalityFit = [...buckets.entries()]
    .filter(([, b]) => b.n > 0)
    .map(([modality, b]) => ({
      modality,
      accuracy: b.correct / b.n,
      n: b.n,
    }));
  modalityFit.sort((a, b) => {
    if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
    if (b.n !== a.n) return b.n - a.n;
    return MODALITY_ORDER.indexOf(a.modality) - MODALITY_ORDER.indexOf(b.modality);
  });

  // ---- processing speed (median latency) -------------------------------
  // Prefer per-item latencies when available; fall back to the per-
  // chapter `avgLatencyMs` aggregate.
  let processingSpeedMs = 0;
  if (responseLatencies.length > 0) {
    const sorted = [...responseLatencies].sort((x, y) => x - y);
    processingSpeedMs =
      sorted.length % 2 === 1
        ? sorted[(sorted.length - 1) / 2]
        : Math.round(
            (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2,
          );
  } else {
    const avgs = chapters
      .map((c) => c.avgLatencyMs)
      .filter((x): x is number => typeof x === "number" && x > 0)
      .sort((a, b) => a - b);
    if (avgs.length > 0) {
      processingSpeedMs =
        avgs.length % 2 === 1
          ? avgs[(avgs.length - 1) / 2]
          : Math.round((avgs[avgs.length / 2 - 1] + avgs[avgs.length / 2]) / 2);
    }
  }

  // ---- frustration rate / attention run length -------------------------
  // We use chapter-level frustration rates if supplied; otherwise fall
  // back to a low-accuracy proxy (a chapter with <40% accuracy is
  // classified as having shown frustration).
  let chaptersWithFrustration = 0;
  let attentionRunLength = chapters.length;
  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i];
    const fr =
      typeof ch.frustrationRate === "number"
        ? ch.frustrationRate
        : ch.total > 0 && ch.correct / ch.total < 0.4
          ? 1
          : 0;
    if (fr >= 0.5) {
      chaptersWithFrustration += 1;
      if (attentionRunLength === chapters.length) attentionRunLength = i;
    }
  }
  const frustrationRate =
    chapters.length === 0 ? 0 : chaptersWithFrustration / chapters.length;
  const frustrationTolerance: DerivedProfile["frustrationTolerance"] =
    frustrationRate >= 0.4 ? "low" : frustrationRate >= 0.15 ? "moderate" : "high";

  const surfaceSignalSummary = surfaceSignals.length > 0
    ? summariseSurfaceSignals(surfaceSignals)
    : undefined;

  return {
    thetaPlacement: Math.round(theta * 10) / 10,
    modalityFit,
    processingSpeedMs,
    frustrationRate,
    attentionRunLength,
    frustrationTolerance,
    itemsAdministered: totalItems,
    surfaceSignalSummary,
    inputModeFit: surfaceSignalSummary?.inputModeFit ?? [],
    scratchpadUseRate: surfaceSignalSummary?.scratchpadUseRate ?? 0,
    hintDependenceRate: surfaceSignalSummary?.hintDependenceRate ?? 0,
    erasureRate: surfaceSignalSummary?.erasureRate ?? 0,
    abandonmentRate: surfaceSignalSummary?.abandonmentRate ?? 0,
    fineMotorDragConcern: surfaceSignalSummary?.fineMotorDragConcern ?? false,
    selfCorrectionSignal: surfaceSignalSummary?.selfCorrectionSignal ?? "low",
    preferredInteractionModes: surfaceSignalSummary?.preferredInteractionModes ?? [],
    supportNeeds: surfaceSignalSummary?.supportNeeds ?? [],
  };
}
