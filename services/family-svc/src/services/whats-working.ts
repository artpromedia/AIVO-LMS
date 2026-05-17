/**
 * "What's working" analytics for the parent dashboard.
 *
 * The current dashboard reports counts ("12 lessons completed"). That is
 * the wrong question. Parents need pattern recognition they can take to
 * an IEP meeting:
 *
 *   - which times of day produce the best learning,
 *   - where frustration spikes,
 *   - which modalities click for which content.
 *
 * This module is pure / synchronous so the route handler can call it
 * with rows it already has in hand (no IO leak). It mirrors the IEP-
 * packet pattern adopted earlier in this PR.
 */

export type Modality = "visual" | "auditory" | "kinesthetic" | "reading";

export type TimeOfDay =
  | "early-morning"
  | "morning"
  | "midday"
  | "afternoon"
  | "evening";

export interface SessionRow {
  /** Local-time ISO-8601 — used to bucket time-of-day. */
  startedAt: string;
  /** Subject of the session, e.g. "math", "ela". */
  subject?: string;
  /** Overall accuracy in the session, 0…1. */
  accuracy: number;
  /** Frustration rate in the session, 0…1. */
  frustrationRate: number;
  /** Minutes the learner sustained engagement before disengaging. */
  attentionMinutes: number;
  /**
   * Modality the learner was primarily using during the session. When
   * unknown the row still contributes to time-of-day stats.
   */
  modality?: Modality;
}

export interface TimeOfDayInsight {
  timeOfDay: TimeOfDay;
  sessions: number;
  meanAccuracy: number;
  meanFrustration: number;
  meanAttentionMinutes: number;
  /** Composite "what worked" score; higher = better window. */
  score: number;
}

export interface FrustrationHotspot {
  /** Subject + modality where frustration concentrates. */
  subject: string;
  modality: Modality | "unknown";
  sessions: number;
  meanFrustration: number;
}

export interface ModalityFitCell {
  subject: string;
  modality: Modality;
  sessions: number;
  meanAccuracy: number;
}

export interface WhatsWorkingInsights {
  windowDays: number;
  totalSessions: number;
  /** Best→worst windows of the day. Buckets with <2 sessions are excluded. */
  timeOfDay: TimeOfDayInsight[];
  /**
   * Best window endorsed for surfacing on the dashboard (≥2 sessions
   * required so a single good morning is not over-claimed).
   */
  bestWindow: TimeOfDayInsight | null;
  /** Worst→best frustration hotspots; clipped to top 3. */
  frustrationHotspots: FrustrationHotspot[];
  /**
   * Subject × modality fit matrix, ordered by accuracy desc within each
   * subject. Buckets with <2 sessions are excluded — single-session fit
   * is not a pattern.
   */
  modalityFit: ModalityFitCell[];
}

const MS_PER_DAY = 86_400_000;

/** Bucket a local hour into a coarse time-of-day window. */
export function bucketLocalHour(hour: number): TimeOfDay {
  if (hour < 7) return "early-morning";
  if (hour < 11) return "morning";
  if (hour < 14) return "midday";
  if (hour < 18) return "afternoon";
  return "evening";
}

export interface ComputeWhatsWorkingOptions {
  /** Trailing window to analyse, in days. Default 30. */
  windowDays?: number;
  /** Reference "now" for the window cut-off — defaults to wall-clock. */
  now?: Date;
}

export function computeWhatsWorking(
  rows: readonly SessionRow[],
  opts: ComputeWhatsWorkingOptions = {},
): WhatsWorkingInsights {
  const windowDays = opts.windowDays ?? 30;
  const now = opts.now ?? new Date();
  const cutoff = now.getTime() - windowDays * MS_PER_DAY;

  const recent = rows.filter((r) => {
    const ts = Date.parse(r.startedAt);
    return Number.isFinite(ts) && ts >= cutoff;
  });

  // ---- time-of-day -----------------------------------------------------
  const todBuckets = new Map<TimeOfDay, SessionRow[]>();
  for (const r of recent) {
    const d = new Date(r.startedAt);
    const tod = bucketLocalHour(d.getHours());
    if (!todBuckets.has(tod)) todBuckets.set(tod, []);
    todBuckets.get(tod)!.push(r);
  }
  const timeOfDay: TimeOfDayInsight[] = [];
  for (const [tod, list] of todBuckets) {
    if (list.length < 2) continue;
    const meanAccuracy = avg(list.map((r) => r.accuracy));
    const meanFrustration = avg(list.map((r) => r.frustrationRate));
    const meanAttentionMinutes = avg(list.map((r) => r.attentionMinutes));
    timeOfDay.push({
      timeOfDay: tod,
      sessions: list.length,
      meanAccuracy,
      meanFrustration,
      meanAttentionMinutes,
      score: meanAccuracy + meanAttentionMinutes / 30 - meanFrustration,
    });
  }
  timeOfDay.sort((a, b) => b.score - a.score);
  const bestWindow = timeOfDay.length > 0 ? timeOfDay[0] : null;

  // ---- frustration hotspots --------------------------------------------
  const hotspotKey = (subject: string, modality: Modality | "unknown") =>
    `${subject}::${modality}`;
  const hotspotBuckets = new Map<string, { subject: string; modality: Modality | "unknown"; rows: SessionRow[] }>();
  for (const r of recent) {
    const subject = r.subject ?? "unknown";
    const modality: Modality | "unknown" = r.modality ?? "unknown";
    const key = hotspotKey(subject, modality);
    if (!hotspotBuckets.has(key)) {
      hotspotBuckets.set(key, { subject, modality, rows: [] });
    }
    hotspotBuckets.get(key)!.rows.push(r);
  }
  const frustrationHotspots: FrustrationHotspot[] = [];
  for (const { subject, modality, rows: list } of hotspotBuckets.values()) {
    if (list.length < 2) continue;
    const meanFrustration = avg(list.map((r) => r.frustrationRate));
    if (meanFrustration < 0.2) continue; // not a hotspot worth reporting
    frustrationHotspots.push({
      subject,
      modality,
      sessions: list.length,
      meanFrustration,
    });
  }
  frustrationHotspots.sort((a, b) => b.meanFrustration - a.meanFrustration);
  frustrationHotspots.length = Math.min(frustrationHotspots.length, 3);

  // ---- subject × modality fit -----------------------------------------
  const fitBuckets = new Map<string, { subject: string; modality: Modality; rows: SessionRow[] }>();
  for (const r of recent) {
    if (!r.modality || !r.subject) continue;
    const key = `${r.subject}::${r.modality}`;
    if (!fitBuckets.has(key)) {
      fitBuckets.set(key, { subject: r.subject, modality: r.modality, rows: [] });
    }
    fitBuckets.get(key)!.rows.push(r);
  }
  const modalityFit: ModalityFitCell[] = [];
  for (const { subject, modality, rows: list } of fitBuckets.values()) {
    if (list.length < 2) continue;
    modalityFit.push({
      subject,
      modality,
      sessions: list.length,
      meanAccuracy: avg(list.map((r) => r.accuracy)),
    });
  }
  modalityFit.sort((a, b) => {
    if (a.subject !== b.subject) return a.subject.localeCompare(b.subject);
    return b.meanAccuracy - a.meanAccuracy;
  });

  return {
    windowDays,
    totalSessions: recent.length,
    timeOfDay,
    bestWindow,
    frustrationHotspots,
    modalityFit,
  };
}

function avg(xs: readonly number[]): number {
  if (xs.length === 0) return 0;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}
