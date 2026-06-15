/**
 * Parent Insight Highlight generator (Data-truth wiring).
 *
 * Derives a single, plain-language headline ("Reading mastery improved 18
 * points") from REAL analytics — the learner's `MasterySnapshot` trajectory.
 * It never fabricates a number: every highlight is reproducible from the
 * snapshots passed in, and carries its own provenance (source + window +
 * sample size + the two dated captures it compared).
 *
 * Design rules:
 *  - Compare the first and last in-window snapshot PER SUBJECT. The delta is
 *    the change in mean mastery, expressed in percentage points (0..100).
 *  - A subject qualifies only with ≥2 snapshots spanning ≥`minSpanDays` real
 *    days and an absolute change ≥`minDeltaPoints` — so we never headline a
 *    same-day blip or statistical noise.
 *  - Lead with the strongest IMPROVEMENT. Only when no subject improved do we
 *    surface the strongest decline — truthful (we never hide a regression when
 *    that is the only signal), but we lead with progress when it exists. The
 *    full picture always lives on Progress / What's Working.
 *  - Deterministic tie-breaks (by subjectId) so the same data always yields
 *    the same highlight.
 *  - Returns `null` when there is not enough data — the UI then shows an
 *    honest empty state rather than an invented insight.
 */
import type { ISODate, MasterySnapshot } from "@/lib/db/types";

export type InsightSource = "mastery_snapshots";

export type InsightHighlight = {
  kind: "mastery_trend";
  subjectId: string;
  subjectName: string;
  direction: "up" | "down";
  /** Absolute change in mean mastery, in percentage points (rounded int). */
  deltaPoints: number;
  /** Mean mastery at the window's first / last snapshot, as 0..100 ints. */
  fromPct: number;
  toPct: number;
  /** Provenance — what the narrative was computed from. */
  source: InsightSource;
  windowDays: number;
  /** The two dated captures the delta was measured between. */
  fromDate: ISODate;
  toDate: ISODate;
  /** Snapshots considered for this subject within the window (reproducibility). */
  sampleSize: number;
};

export type DeriveInsightOptions = {
  /** Defaults to `new Date()`. Injectable for deterministic tests. */
  now?: Date;
  /** Look-back window in days. Default 30. */
  windowDays?: number;
  /** Minimum absolute change (percentage points) to be worth a headline. Default 5. */
  minDeltaPoints?: number;
  /** Minimum real days between the compared captures. Default 2. */
  minSpanDays?: number;
};

const DAY_MS = 86_400_000;

function ms(iso: string): number {
  return new Date(iso).getTime();
}

/**
 * Pick the single most newsworthy mastery trend, or `null` when the data does
 * not support an honest headline.
 */
export function deriveInsightHighlight(
  snapshots: MasterySnapshot[],
  subjectName: (subjectId: string) => string,
  opts: DeriveInsightOptions = {},
): InsightHighlight | null {
  const nowMs = (opts.now ?? new Date()).getTime();
  const windowDays = opts.windowDays ?? 30;
  const minDeltaPoints = opts.minDeltaPoints ?? 5;
  const minSpanDays = opts.minSpanDays ?? 2;
  const windowStartMs = nowMs - windowDays * DAY_MS;

  // Group in-window snapshots by subject.
  const bySubject = new Map<string, MasterySnapshot[]>();
  for (const s of snapshots) {
    const t = ms(s.capturedAt);
    if (Number.isNaN(t) || t < windowStartMs || t > nowMs) continue;
    const arr = bySubject.get(s.subjectId);
    if (arr) arr.push(s);
    else bySubject.set(s.subjectId, [s]);
  }

  const candidates: InsightHighlight[] = [];
  for (const [subjectId, list] of bySubject) {
    if (list.length < 2) continue;
    // Deterministic order: capturedAt asc, id asc as the stable tie-break.
    const sorted = [...list].sort(
      (a, b) => a.capturedAt.localeCompare(b.capturedAt) || a.id.localeCompare(b.id),
    );
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const spanDays = (ms(last.capturedAt) - ms(first.capturedAt)) / DAY_MS;
    if (spanDays < minSpanDays) continue;

    const fromPct = Math.round(first.averageScore * 100);
    const toPct = Math.round(last.averageScore * 100);
    const deltaPoints = toPct - fromPct;
    if (Math.abs(deltaPoints) < minDeltaPoints) continue;

    candidates.push({
      kind: "mastery_trend",
      subjectId,
      subjectName: subjectName(subjectId),
      direction: deltaPoints >= 0 ? "up" : "down",
      deltaPoints: Math.abs(deltaPoints),
      fromPct,
      toPct,
      source: "mastery_snapshots",
      windowDays,
      fromDate: first.capturedAt,
      toDate: last.capturedAt,
      sampleSize: sorted.length,
    });
  }

  if (candidates.length === 0) return null;

  // Lead with the strongest improvement; fall back to the strongest decline
  // only when nothing improved. Deterministic tie-break by subjectId.
  const ups = candidates.filter((c) => c.direction === "up");
  const pool = ups.length > 0 ? ups : candidates;
  pool.sort((a, b) => b.deltaPoints - a.deltaPoints || a.subjectId.localeCompare(b.subjectId));
  return pool[0];
}
