/**
 * Aggregates raw process-aware signals captured by surface-driven
 * activities into a `SurfaceSignalSummary`. The summary feeds the
 * derived learning profile and, downstream, the tutor prompt
 * builder. Pure function — no DB / IO so it is safe to exercise in
 * unit tests.
 */

export interface SurfaceSignal {
  activityId: string;
  domain: string;
  interaction: string;
  finalAnswer?: string | number | boolean;
  correct?: boolean;
  latencyMs?: number;
  inkStrokeCount?: number;
  erasureCount?: number;
  hintCount?: number;
  toolChangeCount?: number;
  abandoned?: boolean;
  audioReplayCount?: number;
  instructionReplayCount?: number;
  dragPrecision?: number;
  scratchpadUsed?: boolean;
}

export interface InputModeFitEntry {
  mode: string;
  accuracy: number;
  n: number;
}

export interface SurfaceSignalSummary {
  inputModeFit: InputModeFitEntry[];
  scratchpadUseRate: number;
  hintDependenceRate: number;
  erasureRate: number;
  abandonmentRate: number;
  averageLatencyByInteraction: Record<string, number>;
  fineMotorDragConcern: boolean;
  selfCorrectionSignal: "low" | "moderate" | "high";
  preferredInteractionModes: string[];
  supportNeeds: string[];
}

const EMPTY_SUMMARY: SurfaceSignalSummary = {
  inputModeFit: [],
  scratchpadUseRate: 0,
  hintDependenceRate: 0,
  erasureRate: 0,
  abandonmentRate: 0,
  averageLatencyByInteraction: {},
  fineMotorDragConcern: false,
  selfCorrectionSignal: "low",
  preferredInteractionModes: [],
  supportNeeds: [],
};

export function summariseSurfaceSignals(signals: readonly SurfaceSignal[]): SurfaceSignalSummary {
  if (!signals || signals.length === 0) return { ...EMPTY_SUMMARY };

  const total = signals.length;

  const byInteraction = new Map<string, { correct: number; n: number; latencies: number[] }>();
  let scratchpadEligible = 0;
  let scratchpadUsed = 0;
  let hintTouched = 0;
  let inkEligible = 0;
  let erasureCountSum = 0;
  let abandonedCount = 0;
  let selfCorrectionHits = 0;
  const dragPrecisionSamples: number[] = [];

  for (const signal of signals) {
    const bucket = byInteraction.get(signal.interaction) ?? { correct: 0, n: 0, latencies: [] };
    bucket.n += 1;
    if (signal.correct) bucket.correct += 1;
    if (typeof signal.latencyMs === "number") bucket.latencies.push(signal.latencyMs);
    byInteraction.set(signal.interaction, bucket);

    if (signal.scratchpadUsed !== undefined) {
      scratchpadEligible += 1;
      if (signal.scratchpadUsed) scratchpadUsed += 1;
    }
    if ((signal.hintCount ?? 0) > 0) hintTouched += 1;
    if (signal.inkStrokeCount !== undefined && signal.inkStrokeCount > 0) {
      inkEligible += 1;
      erasureCountSum += signal.erasureCount ?? 0;
    }
    if (signal.abandoned) abandonedCount += 1;
    if ((signal.erasureCount ?? 0) > 0 || (signal.toolChangeCount ?? 0) > 0) {
      if (signal.correct) selfCorrectionHits += 1;
    }
    if (typeof signal.dragPrecision === "number") {
      dragPrecisionSamples.push(signal.dragPrecision);
    }
  }

  const inputModeFit: InputModeFitEntry[] = [...byInteraction.entries()]
    .filter(([, b]) => b.n > 0)
    .map(([mode, b]) => ({ mode, accuracy: b.correct / b.n, n: b.n }))
    .sort((a, b) => b.accuracy - a.accuracy || b.n - a.n);

  const averageLatencyByInteraction: Record<string, number> = {};
  for (const [mode, b] of byInteraction.entries()) {
    if (b.latencies.length === 0) continue;
    const sum = b.latencies.reduce((acc, x) => acc + x, 0);
    averageLatencyByInteraction[mode] = Math.round(sum / b.latencies.length);
  }

  const scratchpadUseRate = scratchpadEligible > 0 ? scratchpadUsed / scratchpadEligible : 0;
  const hintDependenceRate = hintTouched / total;
  const erasureRate = inkEligible > 0 ? erasureCountSum / inkEligible : 0;
  const abandonmentRate = abandonedCount / total;
  const dragAvg =
    dragPrecisionSamples.length > 0
      ? dragPrecisionSamples.reduce((a, b) => a + b, 0) / dragPrecisionSamples.length
      : 1;
  const fineMotorDragConcern = dragPrecisionSamples.length > 0 && dragAvg < 0.65;

  const selfCorrectionRate = selfCorrectionHits / total;
  const selfCorrectionSignal: SurfaceSignalSummary["selfCorrectionSignal"] =
    selfCorrectionRate >= 0.4 ? "high" : selfCorrectionRate >= 0.15 ? "moderate" : "low";

  const preferredInteractionModes = inputModeFit.slice(0, 3).map((entry) => entry.mode);

  const supportNeeds: string[] = [];
  if (scratchpadUseRate >= 0.5) supportNeeds.push("needs_scratchpad_space");
  if (hintDependenceRate >= 0.4) supportNeeds.push("needs_visual_modeling");
  if (fineMotorDragConcern) supportNeeds.push("needs_reduced_drag_precision");
  if (abandonmentRate >= 0.2) supportNeeds.push("needs_shorter_tasks");
  const audioReplayHits = signals.filter((s) => (s.audioReplayCount ?? 0) > 0).length;
  if (audioReplayHits / total >= 0.3) supportNeeds.push("needs_audio_replay");

  return {
    inputModeFit,
    scratchpadUseRate,
    hintDependenceRate,
    erasureRate,
    abandonmentRate,
    averageLatencyByInteraction,
    fineMotorDragConcern,
    selfCorrectionSignal,
    preferredInteractionModes,
    supportNeeds,
  };
}
