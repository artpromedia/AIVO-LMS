/**
 * @aivo/executive-function
 *
 * The agent as an executive-function partner, not a tutor. ADHD is
 * fundamentally an EF challenge — task initiation, sustained attention,
 * working memory, transitions. This module supplies the four primitives
 * the host runtime composes:
 *
 *   1. `breakDownTask`   — visualisable, weighted micro-step plan.
 *   2. `StuckDetector`   — surfaces "you've been on this 3 minutes — want
 *                          to try a different way?" without nagging.
 *   3. `TimeOfDayMemory` — remembers what worked yesterday morning vs.
 *                          afternoon and biases the next session toward
 *                          the right time-of-day window.
 *   4. `nextStepPrompt`  — quiet next-step nudge (carries the planning
 *                          load the learner does not have to).
 *
 * Pure / synchronous / no IO. Host service handles persistence and
 * delivery (audio cue, haptic, on-screen card).
 */

// ===========================================================================
// 1. Task breakdown
// ===========================================================================

export interface MicroStep {
  /** Stable id within the breakdown. */
  id: string;
  /** Imperative one-liner — how the step is shown to the learner. */
  label: string;
  /** Estimated effort weight 1…5 (used for visual progress bars). */
  weight: number;
  /**
   * Optional sensory / modality hint so the renderer can pick an icon
   * (eye / ear / hand). Not required for correctness.
   */
  modality?: "visual" | "auditory" | "kinesthetic" | "reading";
}

export interface TaskBreakdown {
  taskId: string;
  totalWeight: number;
  steps: MicroStep[];
}

export interface BreakDownTaskInput {
  taskId: string;
  /** Human task title, e.g. "Write 3 sentences about your weekend". */
  title: string;
  /**
   * Author-supplied micro-steps. If empty, the engine emits a generic
   * 4-step plan (read → think → do → check) — small enough to feel
   * achievable, structured enough to actually lift EF load.
   */
  steps?: ReadonlyArray<Omit<MicroStep, "id"> & { id?: string }>;
}

const GENERIC_STEPS: ReadonlyArray<Omit<MicroStep, "id">> = [
  { label: "Read the task once", weight: 1, modality: "reading" },
  { label: "Say what you have to do, in your own words", weight: 2, modality: "auditory" },
  { label: "Do the task — one piece at a time", weight: 4, modality: "kinesthetic" },
  { label: "Check your work", weight: 2, modality: "visual" },
];

export function breakDownTask(input: BreakDownTaskInput): TaskBreakdown {
  const raw: ReadonlyArray<Omit<MicroStep, "id"> & { id?: string }> =
    input.steps && input.steps.length > 0 ? input.steps : GENERIC_STEPS;
  const steps: MicroStep[] = raw.map((s, i) => ({
    id: s.id ?? `${input.taskId}.s${i + 1}`,
    label: s.label,
    weight: clamp(s.weight, 1, 5),
    modality: s.modality,
  }));
  return {
    taskId: input.taskId,
    totalWeight: steps.reduce((acc, s) => acc + s.weight, 0),
    steps,
  };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

// ===========================================================================
// 2. Stuck detector
// ===========================================================================

export type StuckPromptKind =
  | "try-different-modality"
  | "break-it-smaller"
  | "take-a-breath"
  | "ask-for-help";

export interface StuckPrompt {
  kind: StuckPromptKind;
  message: string;
  /** Which step the learner is stuck on. */
  stepId: string;
  /** ms the learner has been on this step. */
  dwellMs: number;
}

export interface StuckDetectorOptions {
  /** Stuck threshold, default 3 minutes. */
  stuckMs?: number;
  /** Cooldown before re-prompting on the same step, default 90s. */
  cooldownMs?: number;
}

export interface StuckTick {
  stepId: string;
  /** Wall-clock ts of this tick. */
  nowMs: number;
  /**
   * Optional hint: if the learner has tried >1 modality and still no
   * progress, escalate to "ask-for-help" instead of repeating the
   * "try-different-modality" suggestion.
   */
  modalitiesTried?: number;
  /** Optional affect signal currently active. */
  affect?: "frustration" | "disengagement" | "calm" | "delight";
}

export class StuckDetector {
  private readonly stuckMs: number;
  private readonly cooldownMs: number;
  /** Step → ts when learner first entered the step. */
  private entries = new Map<string, number>();
  /** Step → ts of last prompt fired. */
  private lastPrompt = new Map<string, number>();

  constructor(opts: StuckDetectorOptions = {}) {
    this.stuckMs = opts.stuckMs ?? 3 * 60 * 1000;
    this.cooldownMs = opts.cooldownMs ?? 90 * 1000;
  }

  /** Mark the learner as having advanced — clears stuck state. */
  advance(toStepId: string, nowMs: number): void {
    this.entries.set(toStepId, nowMs);
  }

  /** Return a prompt if the learner is stuck on the current step. */
  tick(t: StuckTick): StuckPrompt | null {
    const entered = this.entries.get(t.stepId) ?? t.nowMs;
    if (!this.entries.has(t.stepId)) this.entries.set(t.stepId, t.nowMs);
    const dwellMs = t.nowMs - entered;
    if (dwellMs < this.stuckMs) return null;

    const last = this.lastPrompt.get(t.stepId);
    if (last !== undefined && t.nowMs - last < this.cooldownMs) return null;

    this.lastPrompt.set(t.stepId, t.nowMs);

    const kind: StuckPromptKind =
      t.affect === "frustration"
        ? "take-a-breath"
        : (t.modalitiesTried ?? 0) >= 2
          ? "ask-for-help"
          : (t.modalitiesTried ?? 0) >= 1
            ? "break-it-smaller"
            : "try-different-modality";

    const message = MESSAGE_BY_KIND[kind];
    return { kind, message, stepId: t.stepId, dwellMs };
  }
}

const MESSAGE_BY_KIND: Record<StuckPromptKind, string> = {
  "try-different-modality":
    "You've been on this for a few minutes — want to try this a different way?",
  "break-it-smaller": "Let's split this into a smaller piece. We'll just do the first part.",
  "take-a-breath": "This is a tricky one. Take a slow breath — we'll try again together.",
  "ask-for-help": "Would you like to ask a grown-up to help with this one?",
};

// ===========================================================================
// 3. Time-of-day what-worked memory
// ===========================================================================

/** Coarse local-time bucket — matches what shows up in IEP feedback. */
export type TimeOfDay = "early-morning" | "morning" | "midday" | "afternoon" | "evening";

export function bucketLocalHour(hour: number): TimeOfDay {
  if (hour < 7) return "early-morning";
  if (hour < 11) return "morning";
  if (hour < 14) return "midday";
  if (hour < 18) return "afternoon";
  return "evening";
}

export interface SessionOutcome {
  /** Bucketed local time of the session start. */
  timeOfDay: TimeOfDay;
  /** Day of week the session ran on (0=Sun…6=Sat). */
  dayOfWeek: number;
  /** Overall accuracy on the session, 0…1. */
  accuracy: number;
  /** Frustration rate observed during the session, 0…1. */
  frustrationRate: number;
  /** Minutes the learner sustained engagement before disengaging. */
  attentionMinutes: number;
}

export interface TimeOfDayStats {
  timeOfDay: TimeOfDay;
  /** Number of sessions seen in this bucket. */
  n: number;
  /** Mean accuracy. */
  meanAccuracy: number;
  /** Mean frustration rate. */
  meanFrustration: number;
  /** Mean attention minutes. */
  meanAttentionMinutes: number;
  /**
   * Composite "what-worked" score: accuracy + sustained-attention
   * minus frustration. Higher = better window.
   */
  score: number;
}

export class TimeOfDayMemory {
  private readonly outcomes: SessionOutcome[] = [];

  record(o: SessionOutcome): void {
    this.outcomes.push(o);
  }

  /** All observed outcomes — caller may persist/restore via this list. */
  toJSON(): readonly SessionOutcome[] {
    return [...this.outcomes];
  }

  static fromJSON(rows: readonly SessionOutcome[]): TimeOfDayMemory {
    const m = new TimeOfDayMemory();
    for (const r of rows) m.outcomes.push(r);
    return m;
  }

  stats(): TimeOfDayStats[] {
    const buckets = new Map<TimeOfDay, SessionOutcome[]>();
    for (const o of this.outcomes) {
      if (!buckets.has(o.timeOfDay)) buckets.set(o.timeOfDay, []);
      buckets.get(o.timeOfDay)!.push(o);
    }
    const out: TimeOfDayStats[] = [];
    for (const [tod, rows] of buckets) {
      const n = rows.length;
      const meanAccuracy = rows.reduce((s, r) => s + r.accuracy, 0) / n;
      const meanFrustration = rows.reduce((s, r) => s + r.frustrationRate, 0) / n;
      const meanAttentionMinutes = rows.reduce((s, r) => s + r.attentionMinutes, 0) / n;
      const score = meanAccuracy + meanAttentionMinutes / 30 - meanFrustration;
      out.push({
        timeOfDay: tod,
        n,
        meanAccuracy,
        meanFrustration,
        meanAttentionMinutes,
        score,
      });
    }
    out.sort((a, b) => b.score - a.score);
    return out;
  }

  /**
   * Best window of the day. Requires ≥2 observations in a bucket before
   * we'll endorse it — one good morning isn't a pattern.
   */
  bestWindow(): TimeOfDayStats | null {
    const stats = this.stats().filter((s) => s.n >= 2);
    return stats.length > 0 ? stats[0] : null;
  }
}

// ===========================================================================
// 4. Next-step prompt
// ===========================================================================

export interface NextStepPromptInput {
  breakdown: TaskBreakdown;
  /** ids of completed steps. */
  completedStepIds: readonly string[];
}

export interface NextStepPromptOutput {
  /** null when the breakdown is fully complete. */
  next: MicroStep | null;
  /** 0…1 fraction of total weight already completed. */
  progress: number;
  /** Quiet, single-line nudge. */
  message: string;
}

export function nextStepPrompt(input: NextStepPromptInput): NextStepPromptOutput {
  const done = new Set(input.completedStepIds);
  const next = input.breakdown.steps.find((s) => !done.has(s.id)) ?? null;
  const completedWeight = input.breakdown.steps
    .filter((s) => done.has(s.id))
    .reduce((acc, s) => acc + s.weight, 0);
  const progress =
    input.breakdown.totalWeight === 0 ? 1 : completedWeight / input.breakdown.totalWeight;
  const message = next ? `Next: ${next.label}.` : "All done — nice work finishing.";
  return { next, progress, message };
}
