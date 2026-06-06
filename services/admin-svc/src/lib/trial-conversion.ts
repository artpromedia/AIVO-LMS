/**
 * Trials Sprint 1 — trial + pilot conversion math.
 *
 * Pure (no DB) so it is unit-testable; the platform billing endpoint feeds it
 * subscription rows. "Trials" are subscriptions that carried a trial
 * (trialEndsAt set); "pilots" are subscriptions created from a coupon
 * (metadata.couponCode present).
 */
export interface TrialRow {
  status: string | null; // ACTIVE / TRIALING / PAST_DUE / CANCELLED
  trialEndsAt: Date | string | null;
  createdAt: Date | string;
  metadata: Record<string, unknown> | null;
}

export interface TrialConversionReport {
  trialsStartedLast30d: number;
  trialingNow: number;
  trialsEndingIn7d: number;
  convertedLast30d: number;
  /** 0..1; convertedLast30d / trialsStartedLast30d (0 when no trials). */
  conversionRateLast30d: number;
  pilotsStarted: number;
  pilotsConverted: number;
  /** 0..1; pilotsConverted / pilotsStarted (0 when no pilots). */
  pilotConversionRate: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function toDate(v: Date | string | null): Date | null {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function rate(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

export function computeTrialConversion(
  rows: TrialRow[],
  now: Date = new Date(),
): TrialConversionReport {
  const since30 = new Date(now.getTime() - 30 * DAY_MS);
  const in7 = new Date(now.getTime() + 7 * DAY_MS);

  let trialsStartedLast30d = 0;
  let trialingNow = 0;
  let trialsEndingIn7d = 0;
  let convertedLast30d = 0;
  let pilotsStarted = 0;
  let pilotsConverted = 0;

  for (const row of rows) {
    const status = (row.status ?? "").toUpperCase();
    const trialEndsAt = toDate(row.trialEndsAt);
    const createdAt = toDate(row.createdAt);
    const isTrial = trialEndsAt != null;
    const startedRecently = createdAt != null && createdAt >= since30 && createdAt <= now;

    if (status === "TRIALING") {
      trialingNow++;
      if (trialEndsAt && trialEndsAt >= now && trialEndsAt <= in7) trialsEndingIn7d++;
    }

    if (isTrial && startedRecently) {
      trialsStartedLast30d++;
      // Converted = the trial is now a paying/active subscription.
      if (status === "ACTIVE" || status === "PAST_DUE") convertedLast30d++;
    }

    const couponCode = row.metadata?.couponCode;
    if (typeof couponCode === "string" && couponCode.trim()) {
      pilotsStarted++;
      if (status === "ACTIVE" || status === "PAST_DUE") pilotsConverted++;
    }
  }

  return {
    trialsStartedLast30d,
    trialingNow,
    trialsEndingIn7d,
    convertedLast30d,
    conversionRateLast30d: rate(convertedLast30d, trialsStartedLast30d),
    pilotsStarted,
    pilotsConverted,
    pilotConversionRate: rate(pilotsConverted, pilotsStarted),
  };
}
