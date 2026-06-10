/**
 * Multi-signal XP & completion-quality scoring for lesson and tutor sessions.
 * Single source of truth for both learning-svc and tutor-svc.
 * See docs/xp-quality-metrics.md for the full formula and rationale.
 */
export * from "./dape.js";

export interface LessonSignals {
  durationSeconds: number;
  functioningLevel: string;
  beatsCompleted?: number;
  beatsTotal?: number;
  correctAnswers?: number;
  attemptedAnswers?: number;
  engagementBeats?: number;
  breaksUsed?: number;
  masteryDelta?: number;
}

export interface TutorSignals extends LessonSignals {
  messageCount: number;
}

const FUNCTIONING_LEVEL_ENGAGEMENT_WEIGHT: Record<string, number> = {
  STANDARD: 1.0,
  SUPPORTED: 1.5,
  LOW_VERBAL: 2.0,
  NON_VERBAL: 2.5,
  PRE_SYMBOLIC: 3.5,
};

const PRE_SYMBOLIC_LEVELS = new Set(["NON_VERBAL", "PRE_SYMBOLIC"]);

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function computeLessonXp(s: LessonSignals): number {
  const durationMinutes = (s.durationSeconds || 0) / 60;
  const correct = s.correctAnswers ?? 0;
  const masteryDelta = s.masteryDelta ?? 0;
  const engagementBeats = s.engagementBeats ?? s.beatsCompleted ?? 0;
  const levelWeight =
    FUNCTIONING_LEVEL_ENGAGEMENT_WEIGHT[s.functioningLevel] ??
    FUNCTIONING_LEVEL_ENGAGEMENT_WEIGHT.STANDARD;

  // Pre-symbolic / non-verbal learners earn primarily for engagement, not
  // correctness — they may not produce "answers" at all.
  if (PRE_SYMBOLIC_LEVELS.has(s.functioningLevel)) {
    const engagementXp = engagementBeats * levelWeight * 4;
    const durationBonus = Math.min(durationMinutes * 2, 20);
    const masteryBonus = Math.max(0, masteryDelta) * 50;
    return Math.round(clamp(engagementXp + durationBonus + masteryBonus, 0, 100));
  }

  const baseXp = correct * 10;
  const durationBonus = Math.min(durationMinutes * 2, 20);
  const masteryBonus = Math.max(0, masteryDelta) * 50;
  const levelEngagementBonus = levelWeight * engagementBeats;
  return Math.round(clamp(baseXp + durationBonus + masteryBonus + levelEngagementBonus, 0, 100));
}

export function computeCompletionQuality(s: LessonSignals): number {
  const completionRate =
    s.beatsTotal && s.beatsTotal > 0 ? clamp((s.beatsCompleted ?? 0) / s.beatsTotal, 0, 1) : 0.5;

  const correctnessRate =
    s.attemptedAnswers && s.attemptedAnswers > 0
      ? clamp((s.correctAnswers ?? 0) / s.attemptedAnswers, 0, 1)
      : PRE_SYMBOLIC_LEVELS.has(s.functioningLevel)
        ? 0.7
        : 0.5;

  const breaks = s.breaksUsed ?? 0;
  const engagementScore = clamp(1 - breaks * 0.1, 0.3, 1);

  const minutes = (s.durationSeconds || 0) / 60;
  let timeOnTaskScore: number;
  if (minutes < 2) timeOnTaskScore = 0.4;
  else if (minutes < 5) timeOnTaskScore = 0.7;
  else if (minutes <= 25) timeOnTaskScore = 1.0;
  else if (minutes <= 45) timeOnTaskScore = 0.8;
  else timeOnTaskScore = 0.5;

  const score =
    completionRate * 0.3 + correctnessRate * 0.35 + engagementScore * 0.15 + timeOnTaskScore * 0.2;

  return Math.round(clamp(score, 0, 1) * 100) / 100;
}

export function computeTutorXp(s: TutorSignals): number {
  return computeLessonXp({
    ...s,
    engagementBeats: s.engagementBeats ?? Math.max(0, Math.floor(s.messageCount / 2)),
  });
}

export function computeTutorQuality(s: TutorSignals): number {
  // Lacking explicit beats data, treat messageCount as a proxy: ≥6 messages
  // == full completion, scaled linearly below that.
  const hasExplicitBeats = s.beatsTotal !== undefined && s.beatsCompleted !== undefined;
  if (hasExplicitBeats) return computeCompletionQuality(s);

  const completionFromMessages = clamp(s.messageCount / 6, 0, 1);
  return computeCompletionQuality({
    ...s,
    beatsCompleted: Math.round(completionFromMessages * 10),
    beatsTotal: 10,
  });
}

// ---------------------------------------------------------------------------
// Sprint 05 — surface-response scoring
// ---------------------------------------------------------------------------

export type SurfaceScoringMode = "exact" | "rubric" | "process" | "hybrid";

export interface SurfaceRubricCriterion {
  id: string;
  label: string;
  points: number;
  description?: string;
}

export interface SurfaceMisconceptionRule {
  id: string;
  pattern: string;
  feedback: string;
}

export interface SurfaceScoringSpec {
  mode: SurfaceScoringMode;
  correctAnswer?: string | number | boolean;
  rubric?: SurfaceRubricCriterion[];
  misconceptions?: SurfaceMisconceptionRule[];
}

export interface SurfaceResponseInput {
  surfaceId: string;
  answer?: string | number | boolean;
  selectedChoiceId?: string;
  inkStrokes?: unknown[];
  geometryActions?: unknown[];
  durationMs?: number;
  rubricScores?: Record<string, number>;
}

export interface SurfaceScoreResult {
  correct: boolean;
  score: number;
  feedback: string;
  misconceptions: string[];
  mode: SurfaceScoringMode;
}

function normalizeAnswer(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim().toLowerCase();
}

function detectMisconceptions(
  text: string,
  rules: SurfaceMisconceptionRule[] | undefined,
): { ids: string[]; feedback: string[] } {
  if (!rules || rules.length === 0 || !text) {
    return { ids: [], feedback: [] };
  }
  const ids: string[] = [];
  const feedback: string[] = [];
  for (const rule of rules) {
    try {
      const re = new RegExp(rule.pattern, "i");
      if (re.test(text)) {
        ids.push(rule.id);
        feedback.push(rule.feedback);
      }
    } catch {
      // Malformed regex — fall back to substring match.
      if (text.toLowerCase().includes(rule.pattern.toLowerCase())) {
        ids.push(rule.id);
        feedback.push(rule.feedback);
      }
    }
  }
  return { ids, feedback };
}

function scoreExact(
  spec: SurfaceScoringSpec,
  response: SurfaceResponseInput,
): { correct: boolean; score: number } {
  if (spec.correctAnswer === undefined) {
    return { correct: false, score: 0 };
  }
  const expected = normalizeAnswer(spec.correctAnswer);
  const provided =
    response.selectedChoiceId !== undefined
      ? normalizeAnswer(response.selectedChoiceId)
      : normalizeAnswer(response.answer);
  const correct = provided.length > 0 && provided === expected;
  return { correct, score: correct ? 1 : 0 };
}

function scoreRubric(
  spec: SurfaceScoringSpec,
  response: SurfaceResponseInput,
): { correct: boolean; score: number } {
  if (!spec.rubric || spec.rubric.length === 0) {
    return { correct: false, score: 0 };
  }
  const totalPoints = spec.rubric.reduce((sum, c) => sum + (c.points || 0), 0);
  if (totalPoints <= 0) return { correct: false, score: 0 };
  const scores = response.rubricScores ?? {};
  const earned = spec.rubric.reduce((sum, c) => {
    const raw = scores[c.id];
    const capped = typeof raw === "number" ? clamp(raw, 0, c.points) : 0;
    return sum + capped;
  }, 0);
  const score = clamp(earned / totalPoints, 0, 1);
  return { correct: score >= 0.8, score: Math.round(score * 100) / 100 };
}

function scoreProcess(response: SurfaceResponseInput): { correct: boolean; score: number } {
  const ink = response.inkStrokes?.length ?? 0;
  const geom = response.geometryActions?.length ?? 0;
  const engaged = ink > 0 || geom > 0;
  if (!engaged) return { correct: false, score: 0 };
  // Light engagement → 0.5, sustained → 1.0
  const intensity = ink + geom;
  const score = intensity >= 3 ? 1 : 0.5;
  return { correct: true, score };
}

export function scoreSurfaceResponse(
  spec: SurfaceScoringSpec,
  response: SurfaceResponseInput,
): SurfaceScoreResult {
  const mode = spec.mode;
  let base: { correct: boolean; score: number };
  switch (mode) {
    case "exact":
      base = scoreExact(spec, response);
      break;
    case "rubric":
      base = scoreRubric(spec, response);
      break;
    case "process":
      base = scoreProcess(response);
      break;
    case "hybrid": {
      const exact = scoreExact(spec, response);
      const rubric = scoreRubric(spec, response);
      const process = scoreProcess(response);
      const score = clamp(exact.score * 0.5 + rubric.score * 0.3 + process.score * 0.2, 0, 1);
      base = { correct: exact.correct || rubric.correct, score: Math.round(score * 100) / 100 };
      break;
    }
    default:
      base = { correct: false, score: 0 };
  }

  const answerText =
    typeof response.answer === "string"
      ? response.answer
      : response.answer !== undefined
        ? String(response.answer)
        : "";
  const detection = detectMisconceptions(answerText, spec.misconceptions);

  let feedback: string;
  if (detection.feedback.length > 0) {
    feedback = detection.feedback.join(" ");
  } else if (base.correct) {
    feedback = "Correct — nice work!";
  } else if (base.score > 0) {
    feedback = "Partial credit — keep refining your answer.";
  } else if (mode === "process") {
    feedback = "Keep going — show your thinking.";
  } else {
    feedback = "Not quite — review the prompt and try again.";
  }

  return {
    correct: base.correct,
    score: base.score,
    feedback,
    misconceptions: detection.ids,
    mode,
  };
}

// ─── Sprint 06: Auto profile recommendation pipeline ─────────────────────
// Deterministic detector that converts a recent window of SurfaceScoreResults
// (paired with the response inputs that produced them) into candidate
// brain_recommendations rows for parent / teacher review. No LLM — pure
// signal aggregation so it can run inline on every surface submission.

export type RecommendationCandidateKind =
  | "repeated_misconception"
  | "low_process_engagement"
  | "high_hint_dependence"
  | "mastery_signal"
  | "frustration_signal"
  | "accommodation_hint";

export interface RecommendationSignalSample {
  surfaceId: string;
  occurredAt: string; // ISO timestamp
  result: SurfaceScoreResult;
  durationMs?: number;
  inkStrokeCount?: number;
  geometryActionCount?: number;
  hintsRequested?: number;
}

export interface RecommendationCandidate {
  kind: RecommendationCandidateKind;
  /** 0..1 — strength of evidence; >= 0.6 is "actionable". */
  confidence: number;
  title: string;
  rationale: string;
  /** Sample indices (into the input window) that triggered the candidate. */
  evidenceIndices: number[];
  /** Free-form extra evidence (e.g. misconception id list). */
  payload: Record<string, unknown>;
}

export interface RecommendationAnalysisOptions {
  /** Minimum samples required before any candidate is emitted. Default 3. */
  minSamples?: number;
  /** Window cap — only the most recent N samples are considered. Default 12. */
  maxWindow?: number;
}

export interface RecommendationAnalysis {
  sampleCount: number;
  candidates: RecommendationCandidate[];
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function analyzeRecommendationSignals(
  samples: RecommendationSignalSample[],
  options: RecommendationAnalysisOptions = {},
): RecommendationAnalysis {
  const minSamples = options.minSamples ?? 3;
  const maxWindow = options.maxWindow ?? 12;
  const window = samples.slice(-maxWindow);
  if (window.length < minSamples) {
    return { sampleCount: window.length, candidates: [] };
  }

  const candidates: RecommendationCandidate[] = [];

  // 1) Repeated misconception — same misconception id appears >= 2 times.
  const misconceptionCounts = new Map<string, number[]>();
  window.forEach((s, idx) => {
    for (const m of s.result.misconceptions ?? []) {
      const arr = misconceptionCounts.get(m) ?? [];
      arr.push(idx);
      misconceptionCounts.set(m, arr);
    }
  });
  for (const [mid, indices] of misconceptionCounts) {
    if (indices.length >= 2) {
      candidates.push({
        kind: "repeated_misconception",
        confidence: clamp(0.4 + 0.2 * indices.length, 0, 1),
        title: `Recurring misconception: ${mid}`,
        rationale: `Detected ${indices.length}× in last ${window.length} responses.`,
        evidenceIndices: indices,
        payload: { misconceptionId: mid, occurrences: indices.length },
      });
    }
  }

  // 2) Low process engagement — average ink + geometry actions < 1 across window.
  const engagementPerSample = window.map(
    (s) => (s.inkStrokeCount ?? 0) + (s.geometryActionCount ?? 0),
  );
  const engagementAvg = avg(engagementPerSample);
  if (engagementAvg < 1) {
    candidates.push({
      kind: "low_process_engagement",
      confidence: clamp(0.6 + (1 - engagementAvg) * 0.2, 0, 1),
      title: "Low process engagement detected",
      rationale: `Average of ${engagementAvg.toFixed(2)} ink/geometry actions per response.`,
      evidenceIndices: window.map((_, i) => i),
      payload: { engagementAvg },
    });
  }

  // 3) High hint dependence — average hintsRequested >= 2.
  const hintsPerSample = window.map((s) => s.hintsRequested ?? 0);
  const hintsAvg = avg(hintsPerSample);
  if (hintsAvg >= 2) {
    candidates.push({
      kind: "high_hint_dependence",
      confidence: clamp(0.5 + hintsAvg * 0.1, 0, 1),
      title: "High hint dependence",
      rationale: `Average ${hintsAvg.toFixed(1)} hints requested per response.`,
      evidenceIndices: window.map((_, i) => i),
      payload: { hintsAvg },
    });
  }

  // 4) Mastery signal — last 3 results all correct with score >= 0.8.
  const tail = window.slice(-3);
  if (tail.length === 3 && tail.every((s) => s.result.correct && s.result.score >= 0.8)) {
    candidates.push({
      kind: "mastery_signal",
      confidence: 0.8,
      title: "Mastery signal: ready to level up",
      rationale: "Last 3 responses correct with score ≥ 0.8.",
      evidenceIndices: [window.length - 3, window.length - 2, window.length - 1],
      payload: { averageScore: avg(tail.map((s) => s.result.score)) },
    });
  }

  // 5) Frustration signal — three consecutive incorrect AND duration trending up.
  if (tail.length === 3 && tail.every((s) => !s.result.correct)) {
    const durations = tail.map((s) => s.durationMs ?? 0);
    const rising = durations[2] > durations[0] && durations[2] > 5_000;
    if (rising) {
      candidates.push({
        kind: "frustration_signal",
        confidence: 0.7,
        title: "Frustration signal detected",
        rationale: "Three consecutive incorrect responses with rising response time.",
        evidenceIndices: [window.length - 3, window.length - 2, window.length - 1],
        payload: { durations },
      });
    }
  }

  // 6) Accommodation hint — process-mode succeeding while exact-mode failing
  // suggests "show your work" works but final answer needs scaffolding.
  const processSamples = window.filter((s) => s.result.mode === "process" && s.result.correct);
  const exactSamples = window.filter((s) => s.result.mode === "exact" && !s.result.correct);
  if (processSamples.length >= 2 && exactSamples.length >= 2) {
    candidates.push({
      kind: "accommodation_hint",
      confidence: 0.6,
      title: "Consider scaffolding for final-answer step",
      rationale: "Process-mode responses correct but exact-mode responses failing.",
      evidenceIndices: [...processSamples.map((_, i) => i), ...exactSamples.map((_, i) => i)],
      payload: {
        processCorrect: processSamples.length,
        exactIncorrect: exactSamples.length,
      },
    });
  }

  return { sampleCount: window.length, candidates };
}
export * from "./delivery-level.js";
